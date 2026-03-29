"""
OI Momentum Strategy: detects rapid OI buildup in one direction.

Unlike Template D which uses weighted consensus, this strategy looks for
strong unidirectional OI momentum — when both delta magnitude and rate
of change exceed thresholds. It's faster to trigger but more prone to noise.

Logic:
- Computes OI momentum as the rate of OI change (delta / time)
- Bullish: Large PE buildup + CE unwinding = market makers hedging for up move
- Bearish: Large CE buildup + PE unwinding = market makers hedging for down move
- Uses imbalance ratio (PE_total - CE_total) / (PE_total + CE_total) as confirmation
"""

from __future__ import annotations

from ..logging_setup import get_logger
from ..models import OIFeatures, Signal, StrategyContext, StrategyResult
from .base import BaseStrategy

logger = get_logger(__name__)


class OIMomentumStrategy(BaseStrategy):
    def __init__(
        self,
        momentum_threshold: float = 0.15,
        imbalance_confirm_threshold: float = 0.05,
        min_delta_magnitude: float = 500.0,
        confidence_scale: float = 2.0,
    ) -> None:
        self.momentum_threshold = momentum_threshold
        self.imbalance_confirm_threshold = imbalance_confirm_threshold
        self.min_delta_magnitude = min_delta_magnitude
        self.confidence_scale = confidence_scale
        logger.info(
            "oi_momentum initialized momentum_threshold={} imbalance_confirm={} min_delta={}",
            momentum_threshold,
            imbalance_confirm_threshold,
            min_delta_magnitude,
        )

    def evaluate(self, context: StrategyContext) -> StrategyResult:
        # Use shortest available timeframe for speed
        feature = context.features_by_timeframe.get("1m")
        if not feature:
            feature = next(iter(context.features_by_timeframe.values()))

        ce_delta = feature.ce_oi_delta
        pe_delta = feature.pe_oi_delta
        total_delta = abs(ce_delta) + abs(pe_delta)

        # Momentum = net directional pressure (normalized)
        if total_delta > 0:
            momentum = (pe_delta - ce_delta) / total_delta
        else:
            momentum = 0.0

        # Imbalance = structural skew in total OI
        total_oi = feature.pe_oi_total + feature.ce_oi_total
        if total_oi > 0:
            imbalance = (feature.pe_oi_total - feature.ce_oi_total) / total_oi
        else:
            imbalance = 0.0

        # Check multi-timeframe momentum alignment
        votes: dict[str, int] = {}
        aligned_count = 0
        for tf, feat in context.features_by_timeframe.items():
            tf_total = abs(feat.ce_oi_delta) + abs(feat.pe_oi_delta)
            if tf_total > 0:
                tf_momentum = (feat.pe_oi_delta - feat.ce_oi_delta) / tf_total
            else:
                tf_momentum = 0.0

            if tf_momentum > self.momentum_threshold:
                votes[tf] = 1
                if momentum > 0:
                    aligned_count += 1
            elif tf_momentum < -self.momentum_threshold:
                votes[tf] = -1
                if momentum < 0:
                    aligned_count += 1
            else:
                votes[tf] = 0

        # Signal decision
        signal = Signal.NEUTRAL
        has_magnitude = total_delta >= self.min_delta_magnitude
        imbalance_confirms = (
            (momentum > 0 and imbalance > self.imbalance_confirm_threshold)
            or (momentum < 0 and imbalance < -self.imbalance_confirm_threshold)
        )

        if abs(momentum) >= self.momentum_threshold and has_magnitude:
            if momentum > 0 and (imbalance_confirms or aligned_count >= 2):
                signal = Signal.LONG_BIAS
            elif momentum < 0 and (imbalance_confirms or aligned_count >= 2):
                signal = Signal.SHORT_BIAS

        confidence = min(1.0, abs(momentum) * self.confidence_scale)

        weighted_total_delta = 0.0
        tf_weights = {"1m": 0.6, "3m": 0.25, "5m": 0.15}
        for tf, feat in context.features_by_timeframe.items():
            w = tf_weights.get(tf, 0.1)
            weighted_total_delta += w * (abs(feat.ce_oi_delta) + abs(feat.pe_oi_delta))

        reason = (
            f"momentum={momentum:.4f}; imbalance={imbalance:.4f}; "
            f"total_delta={total_delta:.4f}; weighted_total_delta={weighted_total_delta:.4f}; "
            f"aligned_timeframes={aligned_count}; votes={votes}"
        )

        return StrategyResult(
            signal=signal,
            confidence=confidence,
            votes=votes,
            total_delta=total_delta,
            weighted_total_delta=weighted_total_delta,
            reason=reason,
        )
