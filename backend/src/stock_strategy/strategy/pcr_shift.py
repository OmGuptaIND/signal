"""
PCR Shift Strategy: detects Put-Call Ratio regime changes.

Fundamentally different from Template D — instead of looking at OI deltas,
this strategy tracks the Put-Call Ratio (PCR = PE_total / CE_total) and
detects when it crosses key thresholds or shifts rapidly.

Logic:
- PCR > 1.0 is generally bullish (more put writing = support)
- PCR < 0.7 is generally bearish (more call writing = resistance)
- Rapid PCR increase = bullish shift (put writers stepping in)
- Rapid PCR decrease = bearish shift (call writers stepping in)
- Uses multi-timeframe PCR to detect sustained regime changes
"""

from __future__ import annotations

from ..logging_setup import get_logger
from ..models import OIFeatures, Signal, StrategyContext, StrategyResult
from .base import BaseStrategy

logger = get_logger(__name__)


class PCRShiftStrategy(BaseStrategy):
    def __init__(
        self,
        bullish_pcr: float = 1.0,
        bearish_pcr: float = 0.7,
        pcr_shift_threshold: float = 0.05,
        min_oi_for_pcr: float = 100.0,
        confidence_scale: float = 2.0,
    ) -> None:
        self.bullish_pcr = bullish_pcr
        self.bearish_pcr = bearish_pcr
        self.pcr_shift_threshold = pcr_shift_threshold
        self.min_oi_for_pcr = min_oi_for_pcr
        self.confidence_scale = confidence_scale
        logger.info(
            "pcr_shift initialized bullish_pcr={} bearish_pcr={} shift_threshold={}",
            bullish_pcr,
            bearish_pcr,
            pcr_shift_threshold,
        )

    def _compute_pcr(self, feature: OIFeatures) -> float | None:
        """Compute Put-Call Ratio. Returns None if data insufficient."""
        if feature.ce_oi_total < self.min_oi_for_pcr:
            return None
        return feature.pe_oi_total / feature.ce_oi_total

    def _compute_pcr_shift(self, feature: OIFeatures) -> float:
        """Estimate PCR change direction from deltas."""
        total_oi = feature.ce_oi_total + feature.pe_oi_total
        if total_oi <= 0:
            return 0.0
        # Positive shift = PCR increasing (more PE relative to CE)
        # pe_delta positive + ce_delta negative = strong bullish shift
        return (feature.pe_oi_delta - feature.ce_oi_delta) / total_oi

    def evaluate(self, context: StrategyContext) -> StrategyResult:
        votes: dict[str, int] = {}
        pcr_values: dict[str, float] = {}
        shifts: dict[str, float] = {}
        total_delta = 0.0
        weighted_total_delta = 0.0

        tf_weights = {"1m": 0.3, "3m": 0.35, "5m": 0.35}

        for tf, feature in context.features_by_timeframe.items():
            pcr = self._compute_pcr(feature)
            shift = self._compute_pcr_shift(feature)
            w = tf_weights.get(tf, 0.1)

            tf_delta = abs(feature.ce_oi_delta) + abs(feature.pe_oi_delta)
            if tf == "1m":
                total_delta = tf_delta
            weighted_total_delta += w * tf_delta

            if pcr is not None:
                pcr_values[tf] = pcr
                shifts[tf] = shift

                # Vote based on PCR level + shift direction
                if pcr >= self.bullish_pcr and shift >= self.pcr_shift_threshold:
                    votes[tf] = 1  # Bullish: high PCR + increasing
                elif pcr <= self.bearish_pcr and shift <= -self.pcr_shift_threshold:
                    votes[tf] = -1  # Bearish: low PCR + decreasing
                elif pcr >= self.bullish_pcr:
                    votes[tf] = 1  # Moderately bullish: high PCR
                elif pcr <= self.bearish_pcr:
                    votes[tf] = -1  # Moderately bearish: low PCR
                else:
                    votes[tf] = 0  # Neutral zone
            else:
                votes[tf] = 0

        # Determine signal from votes
        bullish_votes = sum(1 for v in votes.values() if v > 0)
        bearish_votes = sum(1 for v in votes.values() if v < 0)
        total_votes = len(votes)

        signal = Signal.NEUTRAL
        if total_votes > 0:
            if bullish_votes > total_votes / 2:
                signal = Signal.LONG_BIAS
            elif bearish_votes > total_votes / 2:
                signal = Signal.SHORT_BIAS

        # Confidence based on PCR extremity and vote unanimity
        if pcr_values:
            latest_pcr = next(iter(pcr_values.values()))
            pcr_distance = abs(latest_pcr - 0.85)  # distance from neutral (~0.85)
            vote_ratio = max(bullish_votes, bearish_votes) / max(total_votes, 1)
            confidence = min(1.0, (pcr_distance + vote_ratio) * self.confidence_scale / 2)
        else:
            confidence = 0.0

        pcr_str = ", ".join(f"{tf}:{v:.3f}" for tf, v in pcr_values.items())
        shift_str = ", ".join(f"{tf}:{v:.4f}" for tf, v in shifts.items())
        reason = (
            f"pcr=[{pcr_str}]; shifts=[{shift_str}]; "
            f"total_delta={total_delta:.4f}; weighted_total_delta={weighted_total_delta:.4f}; "
            f"bullish_votes={bullish_votes}; bearish_votes={bearish_votes}; votes={votes}"
        )

        return StrategyResult(
            signal=signal,
            confidence=confidence,
            votes=votes,
            total_delta=total_delta,
            weighted_total_delta=weighted_total_delta,
            reason=reason,
        )
