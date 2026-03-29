from __future__ import annotations

from datetime import UTC, datetime
import unittest

from stock_strategy.kite_client import _normalize_exchange_timestamp


class KiteClientTimestampTest(unittest.TestCase):
    def test_normalize_naive_exchange_timestamp_as_ist(self) -> None:
        naive_ist = datetime(2026, 3, 6, 10, 40, 11)
        out = _normalize_exchange_timestamp(naive_ist)
        self.assertEqual(out, datetime(2026, 3, 6, 5, 10, 11, tzinfo=UTC))

    def test_normalize_aware_timestamp_to_utc(self) -> None:
        aware_utc = datetime(2026, 3, 6, 5, 10, 11, tzinfo=UTC)
        out = _normalize_exchange_timestamp(aware_utc)
        self.assertEqual(out, aware_utc)


if __name__ == "__main__":
    unittest.main()
