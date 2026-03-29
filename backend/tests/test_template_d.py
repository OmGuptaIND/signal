from __future__ import annotations

from datetime import datetime
import unittest

from stock_strategy.config import TemplateDConfig
from stock_strategy.models import OIFeatures, StrategyContext, Signal
from stock_strategy.strategy.template_d import TemplateDStrategy


class TemplateDTest(unittest.TestCase):
    @staticmethod
    def _cfg() -> TemplateDConfig:
        return TemplateDConfig(
            weights={"1m": 0.5, "3m": 0.3, "5m": 0.2},
            min_oi_delta=10.0,
            signal_threshold=0.1,
            min_consensus_weight=0.6,
            confidence_scale=2.5,
        )

    @staticmethod
    def _ctx(features_by_timeframe: dict[str, OIFeatures]) -> StrategyContext:
        return StrategyContext(
            timestamp=datetime(2026, 3, 5, 10, 0),
            index="NIFTY",
            spot_price=22500,
            atm_strike=22500,
            features_by_timeframe=features_by_timeframe,
        )

    def test_long_bias_deterministic(self) -> None:
        s = TemplateDStrategy(self._cfg())
        f = OIFeatures(
            ce_oi_total=1000,
            pe_oi_total=1300,
            ce_oi_delta=-50,
            pe_oi_delta=60,
            imbalance=0.13,
            momentum=0.04,
        )
        result = s.evaluate(self._ctx({"1m": f, "3m": f, "5m": f}))
        self.assertEqual(result.signal, Signal.LONG_BIAS)
        self.assertGreater(result.confidence, 0)
        self.assertEqual(result.votes["1m"], 1)
        self.assertEqual(result.total_delta, 110)

    def test_short_bias_deterministic(self) -> None:
        s = TemplateDStrategy(self._cfg())
        f = OIFeatures(
            ce_oi_total=1300,
            pe_oi_total=1000,
            ce_oi_delta=80,
            pe_oi_delta=-60,
            imbalance=-0.13,
            momentum=-0.04,
        )
        result = s.evaluate(self._ctx({"1m": f, "3m": f, "5m": f}))
        self.assertEqual(result.signal, Signal.SHORT_BIAS)
        self.assertGreater(result.confidence, 0)

    def test_neutral_on_mixed_votes(self) -> None:
        s = TemplateDStrategy(self._cfg())
        long_f = OIFeatures(1000, 1300, -60, 90, 0.16, 0.05)
        short_f = OIFeatures(1300, 1000, 90, -60, -0.16, -0.05)
        neutral_f = OIFeatures(1000, 1010, 1, 1, 0.01, 0.01)
        result = s.evaluate(
            self._ctx({"1m": long_f, "3m": short_f, "5m": neutral_f})
        )
        self.assertEqual(result.signal, Signal.NEUTRAL)
        self.assertLess(result.confidence, 1.0)

    def test_neutral_when_consensus_weight_is_low(self) -> None:
        s = TemplateDStrategy(self._cfg())
        long_f = OIFeatures(1000, 1300, -60, 90, 0.16, 0.05)
        weak_f = OIFeatures(1100, 1110, -1, 1, 0.02, 0.01)
        # 1m (0.5) can vote long, but without 3m/5m support no alert should fire.
        result = s.evaluate(
            self._ctx({"1m": long_f, "3m": weak_f, "5m": weak_f})
        )
        self.assertEqual(result.signal, Signal.NEUTRAL)

    def test_total_delta_example_is_two(self) -> None:
        s = TemplateDStrategy(
            TemplateDConfig(
                weights={"1m": 0.5, "3m": 0.3, "5m": 0.2},
                min_oi_delta=1.0,
                signal_threshold=0.1,
                min_consensus_weight=0.5,
                confidence_scale=2.5,
            )
        )
        # Example:
        # 10:30 CE=10, PE=11
        # 10:31 CE=9,  PE=12
        # CE delta=-1, PE delta=+1 => total_delta=2
        f = OIFeatures(1000, 1010, -1, 1, 0.0, 0.0)
        result = s.evaluate(self._ctx({"1m": f, "3m": f, "5m": f}))
        self.assertEqual(result.total_delta, 2)


if __name__ == "__main__":
    unittest.main()
