from __future__ import annotations

from datetime import UTC, datetime, timedelta
import unittest

from stock_strategy.models import OptionMeta, Tick
from stock_strategy.oi_aggregator import LiveOIAggregator


class OIAggregatorTest(unittest.TestCase):
    def test_minute_snapshot_and_deltas(self) -> None:
        agg = LiveOIAggregator(
            option_meta_by_token={
                101: OptionMeta(index="NIFTY", strike=22500, option_type="CE"),
                102: OptionMeta(index="NIFTY", strike=22500, option_type="PE"),
            },
            spot_token_to_index={1: "NIFTY"},
            strike_window=0,
        )

        t0 = datetime(2026, 3, 5, 9, 15, 10, tzinfo=UTC)
        t1 = datetime(2026, 3, 5, 9, 16, 1, tzinfo=UTC)

        agg.process_tick(Tick(instrument_token=1, last_price=22510, oi=None, timestamp=t0))
        agg.process_tick(Tick(instrument_token=101, last_price=100, oi=1200, timestamp=t0))
        agg.process_tick(Tick(instrument_token=102, last_price=110, oi=1400, timestamp=t0))

        out = agg.process_tick(Tick(instrument_token=1, last_price=22520, oi=None, timestamp=t1))
        self.assertEqual(len(out), 1)
        snap = out[0]
        self.assertEqual(snap.atm_strike, 22500)
        self.assertEqual(snap.features.ce_oi_total, 1200)
        self.assertEqual(snap.features.pe_oi_total, 1400)
        self.assertEqual(snap.features.ce_oi_delta, 0)
        self.assertEqual(snap.features.pe_oi_delta, 0)

    def test_stale_detection(self) -> None:
        agg = LiveOIAggregator(
            option_meta_by_token={101: OptionMeta(index="NIFTY", strike=22500, option_type="CE")},
            spot_token_to_index={1: "NIFTY"},
            strike_window=0,
        )
        t0 = datetime(2026, 3, 5, 9, 15, 10, tzinfo=UTC)
        agg.process_tick(Tick(instrument_token=1, last_price=22510, oi=None, timestamp=t0))
        stale = agg.detect_stale_indices(t0 + timedelta(minutes=5), max_age_seconds=120)
        self.assertEqual(stale, ["NIFTY"])

    def test_snapshot_uses_last_known_spot_when_no_spot_tick_in_minute(self) -> None:
        agg = LiveOIAggregator(
            option_meta_by_token={
                101: OptionMeta(index="NIFTY", strike=22500, option_type="CE"),
                102: OptionMeta(index="NIFTY", strike=22500, option_type="PE"),
            },
            spot_token_to_index={1: "NIFTY"},
            strike_window=0,
            initial_spot_by_index={"NIFTY": 22512.0},
        )

        t0 = datetime(2026, 3, 5, 9, 15, 10, tzinfo=UTC)
        t1 = datetime(2026, 3, 5, 9, 16, 1, tzinfo=UTC)

        agg.process_tick(Tick(instrument_token=101, last_price=100, oi=1200, timestamp=t0))
        agg.process_tick(Tick(instrument_token=102, last_price=110, oi=1400, timestamp=t0))
        out = agg.process_tick(Tick(instrument_token=101, last_price=101, oi=1210, timestamp=t1))

        self.assertEqual(len(out), 1)
        self.assertEqual(out[0].spot_price, 22512.0)


if __name__ == "__main__":
    unittest.main()
