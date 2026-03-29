from __future__ import annotations

from dataclasses import dataclass

from ..config import TemplateDConfig
from ..logging_setup import get_logger
from ..models import OIFeatures, Signal, StrategyContext, StrategyResult
from .base import BaseStrategy

logger = get_logger(__name__)


@dataclass(slots=True)
class _Vote:
    direction: int
    score: float


class TemplateDStrategy(BaseStrategy):
    """Config-driven rule graph scaffold for Template D."""

    def __init__(self, cfg: TemplateDConfig) -> None:
        self.cfg = cfg
        logger.info(
            "template_d initialized weights={} min_oi_delta={} signal_threshold={} min_consensus_weight={} confidence_scale={}",
            cfg.weights,
            cfg.min_oi_delta,
            cfg.signal_threshold,
            cfg.min_consensus_weight,
            cfg.confidence_scale,
        )

    def evaluate(self, context: StrategyContext) -> StrategyResult:
        weighted_score = 0.0
        votes: dict[str, int] = {}
        bullish_weight = 0.0
        bearish_weight = 0.0
        weighted_total_delta = 0.0

        for tf, feature in context.features_by_timeframe.items():
            vote = self._vote(feature)
            votes[tf] = vote.direction
            weight = self.cfg.weights.get(tf, 0.0)
            weighted_score += weight * vote.score
            weighted_total_delta += weight * (abs(feature.ce_oi_delta) + abs(feature.pe_oi_delta))
            if vote.direction > 0:
                bullish_weight += weight
            elif vote.direction < 0:
                bearish_weight += weight

        consensus_score = bullish_weight - bearish_weight
        if (
            consensus_score >= self.cfg.min_consensus_weight
            and weighted_score >= self.cfg.signal_threshold
        ):
            signal = Signal.LONG_BIAS
        elif (
            consensus_score <= -self.cfg.min_consensus_weight
            and weighted_score <= -self.cfg.signal_threshold
        ):
            signal = Signal.SHORT_BIAS
        else:
            signal = Signal.NEUTRAL

        confidence = min(
            1.0,
            max(abs(weighted_score), abs(consensus_score)) * self.cfg.confidence_scale,
        )
        feature_1m = context.features_by_timeframe.get("1m")
        if feature_1m:
            total_delta = abs(feature_1m.ce_oi_delta) + abs(feature_1m.pe_oi_delta)
        else:
            # Fallback if 1m is unavailable for any reason.
            first_feature = next(iter(context.features_by_timeframe.values()))
            total_delta = abs(first_feature.ce_oi_delta) + abs(first_feature.pe_oi_delta)
        reason = (
            f"weighted_score={weighted_score:.4f}; consensus={consensus_score:.4f}; "
            f"total_delta={total_delta:.4f}; weighted_total_delta={weighted_total_delta:.4f}; "
            f"bullish_weight={bullish_weight:.4f}; bearish_weight={bearish_weight:.4f}; votes={votes}"
        )
        logger.debug(
            "template_d evaluated index={} weighted_score={:.4f} consensus={:.4f} total_delta={:.4f} signal={} confidence={:.4f}",
            context.index,
            weighted_score,
            consensus_score,
            total_delta,
            signal.value,
            confidence,
        )
        return StrategyResult(
            signal=signal,
            confidence=confidence,
            votes=votes,
            total_delta=total_delta,
            weighted_total_delta=weighted_total_delta,
            reason=reason,
        )

    def _vote(self, feature: OIFeatures) -> _Vote:
        ce_delta = feature.ce_oi_delta
        pe_delta = feature.pe_oi_delta
        direction = 0

        # User-defined Template D:
        # bullish -> CE OI decreases while PE OI increases between timestamps.
        # bearish -> CE OI increases while PE OI decreases between timestamps.
        if ce_delta <= -self.cfg.min_oi_delta and pe_delta >= self.cfg.min_oi_delta:
            direction = 1
        elif ce_delta >= self.cfg.min_oi_delta and pe_delta <= -self.cfg.min_oi_delta:
            direction = -1

        magnitude = min(
            1.0,
            min(abs(ce_delta), abs(pe_delta)) / max(self.cfg.min_oi_delta, 1e-9),
        )
        return _Vote(direction=direction, score=direction * magnitude)
