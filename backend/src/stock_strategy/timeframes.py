from __future__ import annotations

from collections import defaultdict, deque

from .models import OIFeatures


class TimeframeBuffer:
    """Stores 1-minute features and derives 3-minute/5-minute aggregates."""

    def __init__(self, maxlen: int = 10) -> None:
        self._features: dict[str, deque[OIFeatures]] = defaultdict(lambda: deque(maxlen=maxlen))

    def push_1m(self, index: str, feature: OIFeatures) -> None:
        self._features[index].append(feature)

    def bar_count(self, index: str) -> int:
        return len(self._features.get(index, ()))

    def get_multi_timeframe(self, index: str) -> dict[str, OIFeatures]:
        if index not in self._features or not self._features[index]:
            return {}

        out = {"1m": self._features[index][-1]}
        out["3m"] = self._aggregate(index, 3)
        out["5m"] = self._aggregate(index, 5)
        return out

    def _aggregate(self, index: str, window: int) -> OIFeatures:
        bars = list(self._features[index])
        if not bars:
            raise ValueError("No bars available")

        subset = bars[-min(window, len(bars)) :]
        latest = subset[-1]
        ce_delta = sum(b.ce_oi_delta for b in subset)
        pe_delta = sum(b.pe_oi_delta for b in subset)
        denom = latest.ce_oi_total + latest.pe_oi_total
        imbalance = (
            (latest.pe_oi_total - latest.ce_oi_total) / denom if denom else 0.0
        )
        momentum = (pe_delta - ce_delta) / denom if denom else 0.0

        return OIFeatures(
            ce_oi_total=latest.ce_oi_total,
            pe_oi_total=latest.pe_oi_total,
            ce_oi_delta=ce_delta,
            pe_oi_delta=pe_delta,
            imbalance=imbalance,
            momentum=momentum,
        )
