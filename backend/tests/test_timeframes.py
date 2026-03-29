from __future__ import annotations

import unittest

from stock_strategy.models import OIFeatures
from stock_strategy.timeframes import TimeframeBuffer


class TimeframeBufferTest(unittest.TestCase):
    def test_derive_3m_5m_from_1m(self) -> None:
        b = TimeframeBuffer(maxlen=10)
        for i in range(1, 6):
            b.push_1m(
                "NIFTY",
                OIFeatures(
                    ce_oi_total=1000 + i,
                    pe_oi_total=1200 + i,
                    ce_oi_delta=float(i),
                    pe_oi_delta=float(i + 1),
                    imbalance=0.1,
                    momentum=0.1,
                ),
            )

        out = b.get_multi_timeframe("NIFTY")
        self.assertEqual(out["3m"].ce_oi_delta, 3 + 4 + 5)
        self.assertEqual(out["3m"].pe_oi_delta, 4 + 5 + 6)
        self.assertEqual(out["5m"].ce_oi_delta, 1 + 2 + 3 + 4 + 5)


if __name__ == "__main__":
    unittest.main()
