"""
RunManager: manages the lifecycle of strategy engine runs via asyncio tasks.

Multiple strategies can run concurrently, sharing one Kite WebSocket connection.
Each strategy gets its own StrategyEngine evaluating the same market snapshots.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from .alerts import DatabaseAlertSink
from .config import load_config
from .db import DatabaseClient
from .engine import StrategyEngine
from .instruments import INDEX_SPOT_SYMBOLS
from .kite_client import KiteConnectClient, prepare_live_subscription
from .logging_setup import get_logger
from .models import Tick
from .models_db import AlertSignal, KiteAuthStatus, StrategyRun
from .oi_aggregator import LiveOIAggregator
from .strategy.registry import get_strategy_definition

logger = get_logger(__name__)

IST = ZoneInfo("Asia/Kolkata")


def _compute_token_expiry() -> datetime:
    """Kite tokens expire at ~6:00 AM IST the next day."""
    now_ist = datetime.now(tz=IST)
    expiry_ist = now_ist.replace(hour=6, minute=0, second=0, microsecond=0)
    if now_ist >= expiry_ist:
        expiry_ist += timedelta(days=1)
    return expiry_ist.astimezone(UTC)


@dataclass
class _RunState:
    run_id: int
    strategy_id: str
    task: asyncio.Task
    stop_event: asyncio.Event


class RunManager:
    def __init__(self, db_client: DatabaseClient, config_path: str = "config.yaml") -> None:
        self.db_client = db_client
        self.config_path = config_path
        self._active_runs: dict[int, _RunState] = {}

    @property
    def active_run_id(self) -> int | None:
        """Backwards compat: return first active run id or None."""
        if not self._active_runs:
            return None
        return next(iter(self._active_runs))

    def get_active_run(self) -> dict | None:
        """Backwards compat: return first active run or None."""
        if not self._active_runs:
            return None
        first_id = next(iter(self._active_runs))
        return self._get_run_by_id(first_id)

    def get_active_runs(self) -> list[dict]:
        """Return all currently active runs."""
        results = []
        for run_id in list(self._active_runs.keys()):
            run_dict = self._get_run_by_id(run_id)
            if run_dict:
                results.append(run_dict)
        return results

    def get_runs(self, limit: int = 20) -> list[dict]:
        with self.db_client.session_factory() as session:
            runs = (
                session.query(StrategyRun)
                .order_by(StrategyRun.id.desc())
                .limit(limit)
                .all()
            )
            return [_run_to_dict(r) for r in runs]

    def get_strategy_active_run(self, strategy_id: str) -> dict | None:
        """Get the active run for a specific strategy, if any."""
        for state in self._active_runs.values():
            if state.strategy_id == strategy_id:
                return self._get_run_by_id(state.run_id)
        return None

    async def start_run(self, access_token: str, api_key: str, api_secret: str, strategy_id: str = "template_d") -> dict:
        """Start a new run for a given strategy. If that strategy is already running, stop it first."""
        # Check if this strategy is already running
        for run_id, state in list(self._active_runs.items()):
            if state.strategy_id == strategy_id:
                logger.info("strategy {} already running as run_id={}, stopping first", strategy_id, run_id)
                await self.stop_run(run_id)
                break

        # Validate strategy exists
        strategy_def = get_strategy_definition(strategy_id)
        if not strategy_def:
            raise ValueError(f"Unknown strategy: {strategy_id}")

        token_expires_at = _compute_token_expiry()

        with self.db_client.session_factory() as session:
            run = StrategyRun(
                strategy_id=strategy_id,
                status="starting",
                started_at=datetime.now(tz=UTC),
                access_token=access_token,
                token_expires_at=token_expires_at,
                signals_count=0,
            )
            session.add(run)
            session.commit()
            session.refresh(run)
            run_id = run.id

        stop_event = asyncio.Event()
        task = asyncio.create_task(
            self._run_engine(run_id, access_token, api_key, api_secret, strategy_id)
        )
        self._active_runs[run_id] = _RunState(
            run_id=run_id,
            strategy_id=strategy_id,
            task=task,
            stop_event=stop_event,
        )
        logger.info("run started run_id={} strategy={} expires_at={}", run_id, strategy_id, token_expires_at.isoformat())

        return self._get_run_by_id(run_id) or {"id": run_id, "status": "starting", "strategy_id": strategy_id}

    async def stop_run(self, run_id: int) -> dict | None:
        """Gracefully stop a run."""
        state = self._active_runs.get(run_id)
        if state:
            state.stop_event.set()
            try:
                await asyncio.wait_for(state.task, timeout=10.0)
            except (TimeoutError, asyncio.CancelledError):
                state.task.cancel()
            self._active_runs.pop(run_id, None)

        with self.db_client.session_factory() as session:
            run = session.query(StrategyRun).get(run_id)
            if run and run.status in ("starting", "running"):
                run.status = "stopped"
                run.stopped_at = datetime.now(tz=UTC)
                session.commit()
                session.refresh(run)
                return _run_to_dict(run)
        return None

    async def stop_all(self) -> None:
        """Stop all active runs."""
        for run_id in list(self._active_runs.keys()):
            await self.stop_run(run_id)

    def _get_run_by_id(self, run_id: int) -> dict | None:
        with self.db_client.session_factory() as session:
            run = session.query(StrategyRun).get(run_id)
            if not run:
                return None
            return _run_to_dict(run)

    async def _run_engine(self, run_id: int, access_token: str, api_key: str, api_secret: str, strategy_id: str) -> None:
        """The actual strategy engine loop — runs as an asyncio.Task."""
        cfg = load_config(self.config_path)
        strategy_def = get_strategy_definition(strategy_id)
        if not strategy_def:
            raise ValueError(f"Unknown strategy: {strategy_id}")

        strategy = strategy_def.create()
        alerts = DatabaseAlertSink(self.db_client, cfg.dedup_confidence_delta, strategy_id=strategy_id)
        engine = StrategyEngine(cfg, strategy, alerts)

        state = self._active_runs.get(run_id)
        if not state:
            return
        stop_event = state.stop_event

        def _update_run_status(status: str, error_message: str | None = None) -> None:
            with self.db_client.session_factory() as session:
                run = session.query(StrategyRun).get(run_id)
                if run:
                    run.status = status
                    if error_message:
                        run.error_message = error_message
                    if status in ("stopped", "expired", "error"):
                        run.stopped_at = datetime.now(tz=UTC)
                        run.signals_count = session.query(AlertSignal).filter(
                            AlertSignal.run_id == run_id
                        ).count()
                    session.commit()

        def _update_auth_status(is_connected: bool, message: str) -> None:
            with self.db_client.session_factory() as session:
                status = session.query(KiteAuthStatus).first()
                if not status:
                    status = KiteAuthStatus()
                    session.add(status)
                status.is_connected = is_connected
                status.message = message
                status.last_updated_at = datetime.now(tz=UTC)
                session.commit()

        try:
            client = KiteConnectClient(
                api_key=api_key,
                api_secret=api_secret,
                access_token=access_token,
                access_token_only=True,
            )

            logger.info("run {} [{}] loading instruments", run_id, strategy_id)
            raw_instruments = await asyncio.to_thread(client.load_instruments)
            ltp_symbols = [INDEX_SPOT_SYMBOLS[symbol] for symbol in cfg.symbols]
            spot_quotes = await asyncio.to_thread(client.get_ltp, ltp_symbols)
            spot_prices = {symbol: spot_quotes[INDEX_SPOT_SYMBOLS[symbol]] for symbol in cfg.symbols}
            logger.info("run {} [{}] spot prices resolved: {}", run_id, strategy_id, spot_prices)

            await asyncio.to_thread(_update_run_status, "running")
            await asyncio.to_thread(_update_auth_status, True, f"Connected — {strategy_id} running")

            subscription = prepare_live_subscription(
                raw_instruments=raw_instruments,
                symbols=cfg.symbols,
                strike_window=cfg.strike_window,
                spot_prices=spot_prices,
                today=date.today(),
            )

            aggregator = LiveOIAggregator(
                option_meta_by_token=subscription.option_meta_by_token,
                spot_token_to_index=subscription.spot_token_to_index,
                strike_window=cfg.strike_window,
                initial_spot_by_index=spot_prices,
            )

            loop = asyncio.get_running_loop()
            tick_queue: asyncio.Queue[Tick] = asyncio.Queue(maxsize=50_000)
            heartbeat_interval = timedelta(seconds=20)
            last_heartbeat_at = datetime.now(tz=UTC)
            ticks_enqueued = 0
            ticks_processed = 0
            snapshots_emitted = 0
            stale_warned: set[str] = set()
            token_expires_at = _compute_token_expiry()

            def _on_tick(tick: Tick) -> None:
                def _enqueue() -> None:
                    nonlocal ticks_enqueued
                    if stop_event.is_set():
                        return
                    try:
                        tick_queue.put_nowait(tick)
                        ticks_enqueued += 1
                    except asyncio.QueueFull:
                        logger.error("tick queue full; dropping tick token={}", tick.instrument_token)
                loop.call_soon_threadsafe(_enqueue)

            client.stream_ticks(subscription.tokens, _on_tick)
            logger.info("run {} [{}] websocket started tokens={}", run_id, strategy_id, len(subscription.tokens))

            try:
                while not stop_event.is_set():
                    # Check token expiry
                    if datetime.now(tz=UTC) >= token_expires_at:
                        logger.warning("run {} [{}] token expired, stopping", run_id, strategy_id)
                        await asyncio.to_thread(_update_run_status, "expired")
                        await asyncio.to_thread(_update_auth_status, False, "Token expired")
                        break

                    try:
                        tick = await asyncio.wait_for(tick_queue.get(), timeout=1.0)
                        ticks_processed += 1
                        snapshots = aggregator.process_tick(tick)
                        snapshots_emitted += len(snapshots)
                        now = datetime.now(tz=UTC)
                        for snap in snapshots:
                            engine.process_snapshot(snap, received_at=now)
                    except TimeoutError:
                        pass

                    now_utc = datetime.now(tz=UTC)
                    if now_utc - last_heartbeat_at >= heartbeat_interval:
                        aggregator.telemetry()
                        if aggregator.current_minute is None:
                            waiting_detail = "waiting for first tick"
                        else:
                            next_minute_close = aggregator.current_minute + timedelta(minutes=1)
                            eta_seconds = max(0, int((next_minute_close - now_utc).total_seconds()))
                            waiting_detail = (
                                f"collecting current_minute={aggregator.current_minute.isoformat()} "
                                f"eta_seconds={eta_seconds}"
                            )
                        logger.info(
                            "run {} [{}] heartbeat: {} ticks_processed={} snapshots={} alerts={}",
                            run_id, strategy_id, waiting_detail, ticks_processed,
                            snapshots_emitted, engine.stats.emitted_alerts,
                        )
                        last_heartbeat_at = now_utc

                    stale = aggregator.detect_stale_indices(datetime.now(tz=UTC), max_age_seconds=180)
                    stale_set = set(stale)
                    new_stale = sorted(stale_set - stale_warned)
                    recovered = sorted(stale_warned - stale_set)
                    if new_stale:
                        logger.warning("run {} [{}] stale feed indices={}", run_id, strategy_id, ",".join(new_stale))
                    if recovered:
                        logger.info("run {} [{}] feed recovered indices={}", run_id, strategy_id, ",".join(recovered))
                    stale_warned = stale_set

                # Drain remaining ticks
                while not tick_queue.empty():
                    tick = tick_queue.get_nowait()
                    snapshots = aggregator.process_tick(tick)
                    for snap in snapshots:
                        engine.process_snapshot(snap, received_at=datetime.now(tz=UTC))

                for snap in aggregator.finalize():
                    engine.process_snapshot(snap, received_at=datetime.now(tz=UTC))
            finally:
                client.stop()

            if stop_event.is_set():
                await asyncio.to_thread(_update_run_status, "stopped")
                await asyncio.to_thread(_update_auth_status, False, f"Run stopped ({strategy_id})")

            logger.info("run {} [{}] finished report={}", run_id, strategy_id, engine.report())

        except Exception as exc:
            logger.error("run {} [{}] engine error: {}", run_id, strategy_id, exc)
            await asyncio.to_thread(_update_run_status, "error", str(exc))
            await asyncio.to_thread(_update_auth_status, False, f"Error ({strategy_id}): {exc}")

        finally:
            self._active_runs.pop(run_id, None)


def _run_to_dict(run: StrategyRun) -> dict:
    return {
        "id": run.id,
        "strategy_id": run.strategy_id or "template_d",
        "status": run.status,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "stopped_at": run.stopped_at.isoformat() if run.stopped_at else None,
        "token_expires_at": run.token_expires_at.isoformat() if run.token_expires_at else None,
        "error_message": run.error_message,
        "signals_count": run.signals_count or 0,
    }
