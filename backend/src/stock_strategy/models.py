from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


class Signal(StrEnum):
    LONG_BIAS = "LONG_BIAS"
    SHORT_BIAS = "SHORT_BIAS"
    NEUTRAL = "NEUTRAL"


@dataclass(slots=True)
class OIFeatures:
    ce_oi_total: float
    pe_oi_total: float
    ce_oi_delta: float
    pe_oi_delta: float
    imbalance: float
    momentum: float


@dataclass(slots=True)
class MarketSnapshot:
    timestamp: datetime
    index: str
    spot_price: float
    atm_strike: int
    features: OIFeatures


@dataclass(slots=True)
class StrategyContext:
    timestamp: datetime
    index: str
    spot_price: float
    atm_strike: int
    features_by_timeframe: dict[str, OIFeatures]


@dataclass(slots=True)
class StrategyResult:
    signal: Signal
    confidence: float
    votes: dict[str, int] = field(default_factory=dict)
    total_delta: float = 0.0
    weighted_total_delta: float = 0.0
    reason: str = ""


@dataclass(slots=True)
class Tick:
    instrument_token: int
    last_price: float
    oi: float | None
    timestamp: datetime


@dataclass(slots=True)
class OptionMeta:
    index: str
    strike: int
    option_type: str
