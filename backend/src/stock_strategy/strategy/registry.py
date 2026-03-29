"""
Strategy registry: maps strategy_id to metadata + factory for instantiation.

Each strategy can be a completely different implementation of BaseStrategy.
The registry stores a factory callable that creates the strategy instance.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from .base import BaseStrategy


@dataclass(slots=True)
class StrategyDefinition:
    id: str
    name: str
    description: str
    how_it_works: str
    factory: Callable[[], BaseStrategy]
    default_params: dict[str, Any] = field(default_factory=dict)

    def create(self) -> BaseStrategy:
        return self.factory()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "how_it_works": self.how_it_works,
            "params": self.default_params,
        }


STRATEGY_REGISTRY: dict[str, StrategyDefinition] = {}


def register_strategy(definition: StrategyDefinition) -> None:
    STRATEGY_REGISTRY[definition.id] = definition


def get_strategy_definition(strategy_id: str) -> StrategyDefinition | None:
    return STRATEGY_REGISTRY.get(strategy_id)


def list_strategies() -> list[dict]:
    return [s.to_dict() for s in STRATEGY_REGISTRY.values()]


def register_builtin_strategies() -> None:
    """Register all built-in strategies. Called at app startup."""
    from ..config import TemplateDConfig
    from .oi_momentum import OIMomentumStrategy
    from .pcr_shift import PCRShiftStrategy
    from .template_d import TemplateDStrategy

    register_strategy(StrategyDefinition(
        id="template_d",
        name="Template D - OI Consensus",
        description="Multi-timeframe OI delta consensus with weighted voting. Balanced across 1m/3m/5m windows.",
        how_it_works=(
            "Analyzes OI changes across 1-minute, 3-minute, and 5-minute timeframes. "
            "Each timeframe votes bullish (CE OI decreasing + PE OI increasing) or bearish (opposite). "
            "Votes are weighted (1m: 50%, 3m: 30%, 5m: 20%) and a consensus score determines the signal. "
            "Requires both weighted score and consensus to exceed thresholds before emitting a directional signal."
        ),
        factory=lambda: TemplateDStrategy(TemplateDConfig(
            weights={"1m": 0.5, "3m": 0.3, "5m": 0.2},
            min_oi_delta=1.0,
            signal_threshold=0.12,
            min_consensus_weight=0.5,
            confidence_scale=2.5,
        )),
        default_params={
            "weights": {"1m": 0.5, "3m": 0.3, "5m": 0.2},
            "min_oi_delta": 1.0,
            "signal_threshold": 0.12,
            "min_consensus_weight": 0.5,
            "confidence_scale": 2.5,
        },
    ))

    register_strategy(StrategyDefinition(
        id="oi_momentum",
        name="OI Momentum",
        description="Detects rapid unidirectional OI buildup. Faster signals but more noise-prone than Template D.",
        how_it_works=(
            "Computes OI momentum as the net directional pressure: (PE_delta - CE_delta) / total_delta. "
            "When momentum exceeds the threshold AND total delta magnitude is significant, it checks for "
            "confirmation via either the structural OI imbalance ratio or multi-timeframe alignment. "
            "Bullish when PE is building up while CE unwinds (market makers hedging for up move). "
            "Faster to trigger than Template D but requires magnitude confirmation to filter noise."
        ),
        factory=lambda: OIMomentumStrategy(
            momentum_threshold=0.15,
            imbalance_confirm_threshold=0.05,
            min_delta_magnitude=500.0,
            confidence_scale=2.0,
        ),
        default_params={
            "momentum_threshold": 0.15,
            "imbalance_confirm_threshold": 0.05,
            "min_delta_magnitude": 500.0,
            "confidence_scale": 2.0,
        },
    ))

    register_strategy(StrategyDefinition(
        id="pcr_shift",
        name="PCR Shift",
        description="Detects Put-Call Ratio regime changes. Structural analysis rather than delta-based.",
        how_it_works=(
            "Tracks the Put-Call Ratio (PCR = PE_total / CE_total) across timeframes. "
            "PCR > 1.0 is bullish (heavy put writing = support), PCR < 0.7 is bearish (heavy call writing = resistance). "
            "Detects regime changes when PCR crosses key thresholds while also shifting in the same direction. "
            "Heavier weight on 3m and 5m timeframes (35% each) to detect sustained structural shifts, not noise. "
            "Fundamentally different from OI delta strategies — looks at ratio levels, not changes."
        ),
        factory=lambda: PCRShiftStrategy(
            bullish_pcr=1.0,
            bearish_pcr=0.7,
            pcr_shift_threshold=0.05,
            min_oi_for_pcr=100.0,
            confidence_scale=2.0,
        ),
        default_params={
            "bullish_pcr": 1.0,
            "bearish_pcr": 0.7,
            "pcr_shift_threshold": 0.05,
            "min_oi_for_pcr": 100.0,
            "confidence_scale": 2.0,
        },
    ))
