from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta

from .instruments import infer_strike_step, select_strike_window
from .logging_setup import get_logger
from .models import MarketSnapshot, OIFeatures, OptionMeta, Tick

logger = get_logger(__name__)


@dataclass(slots=True)
class _MinuteState:
    option_oi: dict[tuple[str, int, str], float]
    spot_by_index: dict[str, float]


class LiveOIAggregator:
    """Builds 1-minute OI snapshots from live ticks."""

    def __init__(
        self,
        option_meta_by_token: dict[int, OptionMeta],
        spot_token_to_index: dict[int, str],
        strike_window: int,
        initial_spot_by_index: dict[str, float] | None = None,
    ) -> None:
        self.option_meta_by_token = option_meta_by_token
        self.spot_token_to_index = spot_token_to_index
        self.strike_window = strike_window
        self.current_minute: datetime | None = None
        self._minute_state = _MinuteState(option_oi={}, spot_by_index={})
        self._last_spot_by_index: dict[str, float] = dict(initial_spot_by_index or {})
        self._last_closed_totals: dict[str, tuple[float, float]] = {}
        self._last_tick_time: dict[str, datetime] = {}
        self._spot_tick_count = 0
        self._option_tick_count = 0
        self._option_tick_with_oi_count = 0
        logger.info(
            "oi aggregator initialized option_tokens={} spot_tokens={} strike_window={}",
            len(option_meta_by_token),
            len(spot_token_to_index),
            strike_window,
        )

    @staticmethod
    def _to_minute(ts: datetime) -> datetime:
        return ts.replace(second=0, microsecond=0)

    def process_tick(self, tick: Tick) -> list[MarketSnapshot]:
        emitted: list[MarketSnapshot] = []
        minute = self._to_minute(tick.timestamp)

        if self.current_minute is None:
            self.current_minute = minute
            logger.debug("aggregator minute anchor initialized minute={}", minute)

        if minute > self.current_minute:
            emitted.extend(self._flush_until(minute))
            if emitted:
                logger.debug(
                    "minute flush emitted snapshots={} up_to_minute={}",
                    len(emitted),
                    minute,
                )

        self._ingest_tick(tick)
        return emitted

    def finalize(self) -> list[MarketSnapshot]:
        if self.current_minute is None:
            return []
        snapshots = self._flush_until(self.current_minute + timedelta(minutes=1))
        logger.info("aggregator finalized snapshots={}", len(snapshots))
        return snapshots

    def detect_stale_indices(self, now: datetime, max_age_seconds: int = 120) -> list[str]:
        stale: list[str] = []
        for index, last in self._last_tick_time.items():
            if (now - last).total_seconds() > max_age_seconds:
                stale.append(index)
        stale_sorted = sorted(set(stale))
        if stale_sorted:
            logger.warning("stale indices detected={} max_age_seconds={}", stale_sorted, max_age_seconds)
        return stale_sorted

    def telemetry(self) -> dict[str, int]:
        return {
            "spot_ticks": self._spot_tick_count,
            "option_ticks": self._option_tick_count,
            "option_ticks_with_oi": self._option_tick_with_oi_count,
        }

    def _flush_until(self, next_minute: datetime) -> list[MarketSnapshot]:
        assert self.current_minute is not None
        snapshots: list[MarketSnapshot] = []
        while self.current_minute < next_minute:
            snapshots.extend(self._build_snapshots_for_minute(self.current_minute))
            self.current_minute += timedelta(minutes=1)
            self._minute_state = _MinuteState(option_oi={}, spot_by_index={})
        logger.debug("flush completed next_minute={} snapshots={}", next_minute, len(snapshots))
        return snapshots

    def _ingest_tick(self, tick: Tick) -> None:
        token = tick.instrument_token

        if token in self.spot_token_to_index:
            index = self.spot_token_to_index[token]
            self._minute_state.spot_by_index[index] = tick.last_price
            self._last_spot_by_index[index] = tick.last_price
            self._last_tick_time[index] = tick.timestamp
            self._spot_tick_count += 1
            return

        meta = self.option_meta_by_token.get(token)
        if not meta:
            return
        self._option_tick_count += 1
        if tick.oi is None:
            return

        key = (meta.index, meta.strike, meta.option_type)
        self._minute_state.option_oi[key] = float(tick.oi)
        self._last_tick_time[meta.index] = tick.timestamp
        self._option_tick_with_oi_count += 1

    def _build_snapshots_for_minute(self, minute: datetime) -> list[MarketSnapshot]:
        grouped: dict[str, dict[tuple[int, str], float]] = defaultdict(dict)
        for (index, strike, option_type), oi in self._minute_state.option_oi.items():
            grouped[index][(strike, option_type)] = oi

        snapshots: list[MarketSnapshot] = []
        for index, strike_map in grouped.items():
            spot = self._minute_state.spot_by_index.get(index) or self._last_spot_by_index.get(index)
            if spot is None:
                continue

            step = infer_strike_step(index)
            atm = int(round(spot / step) * step)
            strike_set = set(select_strike_window(atm, step, self.strike_window))

            ce_total = 0.0
            pe_total = 0.0
            for strike in strike_set:
                ce_total += strike_map.get((strike, "CE"), 0.0)
                pe_total += strike_map.get((strike, "PE"), 0.0)

            prev_ce, prev_pe = self._last_closed_totals.get(index, (ce_total, pe_total))
            ce_delta = ce_total - prev_ce
            pe_delta = pe_total - prev_pe

            denom = ce_total + pe_total
            imbalance = (pe_total - ce_total) / denom if denom else 0.0
            momentum = (pe_delta - ce_delta) / denom if denom else 0.0

            self._last_closed_totals[index] = (ce_total, pe_total)
            logger.debug(
                "snapshot built index={} minute={} spot={} atm={} ce_total={} pe_total={}",
                index,
                minute,
                spot,
                atm,
                ce_total,
                pe_total,
            )
            snapshots.append(
                MarketSnapshot(
                    timestamp=minute,
                    index=index,
                    spot_price=spot,
                    atm_strike=atm,
                    features=OIFeatures(
                        ce_oi_total=ce_total,
                        pe_oi_total=pe_total,
                        ce_oi_delta=ce_delta,
                        pe_oi_delta=pe_delta,
                        imbalance=imbalance,
                        momentum=momentum,
                    ),
                )
            )

        return snapshots
