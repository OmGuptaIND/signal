from __future__ import annotations

import asyncio
from dataclasses import dataclass

from .db import DatabaseClient
from .events import broadcaster
from .logging_setup import get_logger
from .models import StrategyContext, StrategyResult
from .models_db import AlertSignal

logger = get_logger(__name__)

@dataclass(slots=True)
class _LastAlert:
    signal: str
    confidence: float

class DatabaseAlertSink:
    def __init__(self, db_client: DatabaseClient, dedup_confidence_delta: float, strategy_id: str = "template_d") -> None:
        self.db_client = db_client
        self.dedup_confidence_delta = dedup_confidence_delta
        self.strategy_id = strategy_id
        self._last_alert_by_index: dict[str, _LastAlert] = {}
        logger.info(
            "database alert sink initialized strategy_id={} dedup_confidence_delta={}",
            strategy_id,
            dedup_confidence_delta,
        )

    @staticmethod
    def _format_votes(votes: dict[str, int]) -> str:
        if not votes:
            return ""
        ordered = [f"{tf}:{votes.get(tf, 0)}" for tf in ("1m", "3m", "5m")]
        return ",".join(ordered)

    def emit(self, context: StrategyContext, result: StrategyResult) -> bool:
        signal = result.signal.value
        last = self._last_alert_by_index.get(context.index)

        if last and last.signal == signal:
            if abs(last.confidence - result.confidence) < self.dedup_confidence_delta:
                logger.debug(
                    "alert deduplicated index={} signal={} confidence={} last_confidence={}",
                    context.index,
                    signal,
                    result.confidence,
                    last.confidence,
                )
                return False

        self._last_alert_by_index[context.index] = _LastAlert(
            signal=signal,
            confidence=result.confidence,
        )

        db_signal = AlertSignal(
            strategy_id=self.strategy_id,
            timestamp=context.timestamp,
            index_name=context.index,
            signal=signal,
            confidence=result.confidence,
            total_delta=result.total_delta,
            weighted_total_delta=result.weighted_total_delta,
            timeframe_votes=DatabaseAlertSink._format_votes(result.votes),
            spot_price=context.spot_price,
            atm_strike=context.atm_strike,
            reason=result.reason,
        )

        def _write_and_broadcast() -> None:
            try:
                with self.db_client.session_factory() as session:
                    session.add(db_signal)
                    session.commit()
                    session.refresh(db_signal)

                    broadcaster.put_nowait("new_signal", {
                        "id": db_signal.id,
                        "strategy_id": db_signal.strategy_id,
                        "timestamp": db_signal.timestamp.isoformat(),
                        "index_name": db_signal.index_name,
                        "signal": db_signal.signal,
                        "confidence": db_signal.confidence,
                        "total_delta": db_signal.total_delta,
                        "weighted_total_delta": db_signal.weighted_total_delta,
                        "timeframe_votes": db_signal.timeframe_votes,
                        "spot_price": db_signal.spot_price,
                        "atm_strike": db_signal.atm_strike,
                        "reason": db_signal.reason
                    })
                logger.info(
                    "signal persisted to database index={} signal={} confidence={}",
                    context.index,
                    signal,
                    result.confidence,
                )
            except Exception as e:
                logger.error("Failed to async save/broadcast signal: {}", e)

        try:
            loop = asyncio.get_running_loop()
            loop.call_soon_threadsafe(
                lambda: asyncio.create_task(asyncio.to_thread(_write_and_broadcast))
            )
        except RuntimeError:
            # Fallback if no event loop
            _write_and_broadcast()

        return True
