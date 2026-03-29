import asyncio
from collections.abc import Generator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from ..config import load_secrets
from ..db import DatabaseClient
from ..events import broadcaster
from ..logging_setup import get_logger
from ..models_db import AlertSignal
from ..run_manager import RunManager
from ..strategy.registry import register_builtin_strategies

logger = get_logger(__name__)

# Application State / Dependencies
_global_secrets = load_secrets(".env")
_global_db_client = None
_global_run_manager = None

register_builtin_strategies()

try:
    _global_db_client = DatabaseClient(_global_secrets.database_url)
    _global_db_client.init_db()
except Exception as exc:
    logger.warning(f"Failed to initialize global db client: {exc}")

if _global_db_client:
    _global_run_manager = RunManager(_global_db_client)


def get_secrets():
    return _global_secrets


def reload_secrets(env_path: str = ".env"):
    global _global_secrets
    _global_secrets = load_secrets(env_path)
    return _global_secrets


def get_db_session() -> Generator:
    if not _global_db_client:
        yield None
        return
    with _global_db_client.session_factory() as session:
        yield session


def get_run_manager():
    return _global_run_manager


class DatabasePoller:
    def __init__(self, db_client, broadcaster, check_interval=1.0):
        self.db_client = db_client
        self.broadcaster = broadcaster
        self.check_interval = check_interval

    async def poll(self):
        last_seen_id = 0

        def _fetch_signals(current_last_seen_id):
            if not self.db_client:
                return [], current_last_seen_id
            with self.db_client.session_factory() as session:
                if current_last_seen_id == 0:
                    latest = session.query(AlertSignal).order_by(AlertSignal.id.desc()).first()
                    return [], (latest.id if latest else 0)
                else:
                    new_signals = (
                        session.query(AlertSignal)
                        .filter(AlertSignal.id > current_last_seen_id)
                        .order_by(AlertSignal.id.asc())
                        .all()
                    )
                    ready_signals = []
                    for s in new_signals:
                        ready_signals.append({
                            "id": s.id,
                            "strategy_id": s.strategy_id or "template_d",
                            "timestamp": s.timestamp.isoformat(),
                            "index_name": s.index_name,
                            "signal": s.signal,
                            "confidence": s.confidence,
                            "total_delta": s.total_delta,
                            "weighted_total_delta": s.weighted_total_delta,
                            "timeframe_votes": s.timeframe_votes,
                            "spot_price": s.spot_price,
                            "atm_strike": s.atm_strike,
                            "reason": s.reason,
                        })
                    new_last_seen = current_last_seen_id
                    if new_signals:
                        new_last_seen = max(current_last_seen_id, new_signals[-1].id)
                    return ready_signals, new_last_seen

        while True:
            try:
                if self.db_client:
                    new_signals, last_seen_id = await asyncio.to_thread(_fetch_signals, last_seen_id)
                    for s in new_signals:
                        self.broadcaster.put_nowait("new_signal", s)
            except Exception as exc:
                logger.error(f"Error polling db for signals: {exc}")

            await asyncio.sleep(self.check_interval)


@asynccontextmanager
async def lifespan(app: FastAPI):
    poller = DatabasePoller(_global_db_client, broadcaster)
    task = asyncio.create_task(poller.poll())
    yield
    task.cancel()
