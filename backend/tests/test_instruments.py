from __future__ import annotations

from datetime import date
import unittest

from stock_strategy.instruments import (
    nearest_expiry,
    parse_instruments,
    resolve_option_universe,
    round_to_step,
    select_strike_window,
)


class InstrumentsTest(unittest.TestCase):
    def test_round_and_window(self) -> None:
        self.assertEqual(round_to_step(22534, 50), 22550)
        self.assertEqual(select_strike_window(22500, 50, 2), [22400, 22450, 22500, 22550, 22600])

    def test_resolve_option_universe_atm_pm5(self) -> None:
        rows = []
        for strike in range(22300, 22801, 50):
            rows.append(
                {
                    "instrument_token": strike,
                    "tradingsymbol": f"NIFTY{strike}CE",
                    "name": "NIFTY",
                    "exchange": "NFO",
                    "segment": "NFO-OPT",
                    "instrument_type": "CE",
                    "strike": float(strike),
                    "expiry": "2026-03-12",
                }
            )
            rows.append(
                {
                    "instrument_token": strike + 1,
                    "tradingsymbol": f"NIFTY{strike}PE",
                    "name": "NIFTY",
                    "exchange": "NFO",
                    "segment": "NFO-OPT",
                    "instrument_type": "PE",
                    "strike": float(strike),
                    "expiry": "2026-03-12",
                }
            )

        universe = resolve_option_universe(
            instruments=parse_instruments(rows),
            index="NIFTY",
            spot_price=22526.0,
            strike_window=5,
            today=date(2026, 3, 5),
        )

        self.assertEqual(universe.atm_strike, 22550)
        self.assertEqual(len(universe.strikes), 11)
        self.assertEqual(universe.strikes[0], 22300)
        self.assertEqual(universe.strikes[-1], 22800)
        self.assertEqual(len(universe.instrument_tokens), 22)

    def test_nearest_expiry(self) -> None:
        rows = parse_instruments(
            [
                {
                    "instrument_token": 1,
                    "name": "NIFTY",
                    "instrument_type": "CE",
                    "expiry": "2026-03-12",
                },
                {
                    "instrument_token": 2,
                    "name": "NIFTY",
                    "instrument_type": "PE",
                    "expiry": "2026-03-19",
                },
            ]
        )
        self.assertEqual(nearest_expiry(rows, date(2026, 3, 5)).isoformat(), "2026-03-12")


if __name__ == "__main__":
    unittest.main()
