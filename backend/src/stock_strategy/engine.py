from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, time
from zoneinfo import ZoneInfo

from .alerts import DatabaseAlertSink
from .config import AppConfig
from .logging_setup import get_logger
from .models import MarketSnapshot, Signal, StrategyContext, StrategyResult
from .strategy.base import BaseStrategy
from .timeframes import TimeframeBuffer

logger = get_logger(__name__)


@dataclass(slots=True)
class EngineStats:
    evaluations: int = 0
    emitted_alerts: int = 0
    transitions: int = 0
    latency_samples_ms: list[float] = field(default_factory=list)


class StrategyEngine:
    def __init__(self, config: AppConfig, strategy: BaseStrategy, alerts: DatabaseAlertSink) -> None:
        self.config = config
        self.strategy = strategy
        self.alerts = alerts
        self.timeframes = TimeframeBuffer(maxlen=10)
        self.tz = ZoneInfo(config.timezone)
        self._market_start = _parse_hhmm(config.market_start)
        self._market_end = _parse_hhmm(config.market_end)
        self._last_signal_by_index: dict[str, Signal] = {}
        self._tf_ready_by_index: dict[str, tuple[bool, bool, bool]] = {}
        self.stats = EngineStats()
        logger.info(
            "engine initialized symbols={} market_window={}..{} timezone={}",
            config.symbols,
            config.market_start,
            config.market_end,
            config.timezone,
        )

    def process_snapshot(
        self,
        snapshot: MarketSnapshot,
        received_at: datetime | None = None,
    ) -> StrategyResult | None:
        if not self._in_market_window(snapshot.timestamp):
            logger.debug(
                "snapshot skipped outside market window index={} ts={}",
                snapshot.index,
                snapshot.timestamp,
            )
            return None

        logger.info(
            "new 1m data appeared index={} ts={} spot={} atm={}",
            snapshot.index,
            snapshot.timestamp,
            round(snapshot.spot_price, 2),
            snapshot.atm_strike,
        )
        self.timeframes.push_1m(snapshot.index, snapshot.features)
        bars = self.timeframes.bar_count(snapshot.index)
        tf_ready = (bars >= 1, bars >= 3, bars >= 5)
        if self._tf_ready_by_index.get(snapshot.index) != tf_ready:
            logger.info(
                "timeframe readiness updated index={} bars={} ready_1m={} ready_3m={} ready_5m={}",
                snapshot.index,
                bars,
                tf_ready[0],
                tf_ready[1],
                tf_ready[2],
            )
            self._tf_ready_by_index[snapshot.index] = tf_ready

        features_by_tf = self.timeframes.get_multi_timeframe(snapshot.index)
        if not features_by_tf:
            logger.debug("snapshot skipped due to empty timeframe features index={}", snapshot.index)
            return None

        context = StrategyContext(
            timestamp=_to_tz(snapshot.timestamp, self.tz),
            index=snapshot.index,
            spot_price=snapshot.spot_price,
            atm_strike=snapshot.atm_strike,
            features_by_timeframe=features_by_tf,
        )

        result = self.strategy.evaluate(context)
        self.stats.evaluations += 1
        logger.debug(
            "strategy evaluated index={} signal={} confidence={:.4f}",
            snapshot.index,
            result.signal.value,
            result.confidence,
        )

        prior = self._last_signal_by_index.get(snapshot.index)
        if prior is not None and prior != result.signal:
            self.stats.transitions += 1
        self._last_signal_by_index[snapshot.index] = result.signal

        if received_at is not None:
            latency_ms = (_to_tz(received_at, self.tz) - context.timestamp).total_seconds() * 1000
            self.stats.latency_samples_ms.append(max(0.0, latency_ms))

        if self.alerts.emit(context, result):
            self.stats.emitted_alerts += 1
            logger.debug("alert emitted index={} signal={}", snapshot.index, result.signal.value)
        return result

    def report(self) -> dict[str, float | int]:
        latencies = self.stats.latency_samples_ms
        avg_latency = sum(latencies) / len(latencies) if latencies else 0.0
        return {
            "evaluations": self.stats.evaluations,
            "emitted_alerts": self.stats.emitted_alerts,
            "transitions": self.stats.transitions,
            "avg_latency_ms": round(avg_latency, 2),
        }

    def _in_market_window(self, ts: datetime) -> bool:
        local = _to_tz(ts, self.tz)
        t = local.timetz().replace(tzinfo=None)
        return self._market_start <= t <= self._market_end


def _to_tz(ts: datetime, tz: ZoneInfo) -> datetime:
    if ts.tzinfo is None:
        return ts.replace(tzinfo=tz)
    return ts.astimezone(tz)


def _parse_hhmm(raw: str) -> time:
    hour, minute = raw.split(":", 1)
    return time(hour=int(hour), minute=int(minute))
