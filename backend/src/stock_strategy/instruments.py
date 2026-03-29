from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date

INDEX_SPOT_SYMBOLS = {
    "NIFTY": "NSE:NIFTY 50",
    "BANKNIFTY": "NSE:NIFTY BANK",
    "SENSEX": "BSE:SENSEX",
}


@dataclass(slots=True)
class Instrument:
    instrument_token: int
    tradingsymbol: str
    name: str
    exchange: str
    segment: str
    instrument_type: str
    strike: float
    expiry: date | None


@dataclass(slots=True)
class OptionUniverse:
    index: str
    expiry: date
    atm_strike: int
    strikes: list[int]
    instrument_tokens: list[int]


def parse_instruments(raw_rows: Iterable[dict]) -> list[Instrument]:
    out: list[Instrument] = []
    for row in raw_rows:
        expiry_raw = row.get("expiry")
        expiry: date | None
        if isinstance(expiry_raw, date):
            expiry = expiry_raw
        elif isinstance(expiry_raw, str) and expiry_raw:
            expiry = date.fromisoformat(expiry_raw)
        else:
            expiry = None
        out.append(
            Instrument(
                instrument_token=int(row["instrument_token"]),
                tradingsymbol=str(row.get("tradingsymbol", "")),
                name=str(row.get("name", "")),
                exchange=str(row.get("exchange", "")),
                segment=str(row.get("segment", "")),
                instrument_type=str(row.get("instrument_type", "")),
                strike=float(row.get("strike", 0.0)),
                expiry=expiry,
            )
        )
    return out


def infer_strike_step(index: str) -> int:
    return {"NIFTY": 50, "BANKNIFTY": 100, "SENSEX": 100}.get(index, 50)


def nearest_expiry(instruments: Iterable[Instrument], today: date) -> date:
    expiries = sorted({i.expiry for i in instruments if i.expiry and i.expiry >= today})
    if not expiries:
        raise ValueError("No future expiry found")
    return expiries[0]


def round_to_step(value: float, step: int) -> int:
    return int(round(value / step) * step)


def select_strike_window(atm_strike: int, strike_step: int, strike_window: int) -> list[int]:
    return [atm_strike + (offset * strike_step) for offset in range(-strike_window, strike_window + 1)]


def resolve_option_universe(
    instruments: list[Instrument],
    index: str,
    spot_price: float,
    strike_window: int,
    today: date,
) -> OptionUniverse:
    idx_options = [
        i
        for i in instruments
        if i.name.upper() == index.upper() and i.instrument_type in {"CE", "PE"}
    ]
    if not idx_options:
        raise ValueError(f"No option contracts found for {index}")

    expiry = nearest_expiry(idx_options, today)
    strike_step = infer_strike_step(index)
    atm = round_to_step(spot_price, strike_step)
    strike_range = set(select_strike_window(atm, strike_step, strike_window))

    tokens = [
        i.instrument_token
        for i in idx_options
        if i.expiry == expiry and int(i.strike) in strike_range
    ]
    if not tokens:
        raise ValueError(f"No tokens selected for {index} expiry {expiry}")

    return OptionUniverse(
        index=index,
        expiry=expiry,
        atm_strike=atm,
        strikes=sorted(strike_range),
        instrument_tokens=tokens,
    )


def resolve_spot_tokens(instruments: Iterable[Instrument]) -> dict[str, int]:
    wanted = {
        "NIFTY": {"NIFTY 50", "NIFTY50"},
        "BANKNIFTY": {"NIFTY BANK", "NIFTYBANK"},
        "SENSEX": {"SENSEX"},
    }
    out: dict[str, int] = {}
    for inst in instruments:
        symbol = inst.tradingsymbol.upper().replace(" ", "")
        for index, candidates in wanted.items():
            normalized_candidates = {c.upper().replace(" ", "") for c in candidates}
            if symbol in normalized_candidates:
                out[index] = inst.instrument_token
    return out
