#!/usr/bin/env python3
"""
Monies — OI Flow Analyser

Single-file analyser for NIFTY, BANKNIFTY, SENSEX options.
Connects to Kite, fetches live OI data, and runs analysis:
  - OI deltas & flow direction
  - CMP, VWAP signals
  - PCR (per-strike + index-level)
  - Support (max PE OI) & Resistance (max CE OI)
  - Shift detection (S/R moved, ATM moved)
  - ATM color tracking (🟢 🔵 🟠)

Usage:
    cd analyser
    cp .env.example .env   # fill in your keys
    uv run analyser.py
"""

from __future__ import annotations

import os
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime

import pandas as pd
import pytz
from dotenv import load_dotenv
from kiteconnect import KiteConnect

load_dotenv()

# =====================================================================
# CONFIG
# =====================================================================

STRIKE_INTERVALS = {"NIFTY": 50, "BANKNIFTY": 100, "SENSEX": 100}
INDEX_SYMBOLS = {"NIFTY": "NSE:NIFTY 50", "BANKNIFTY": "NSE:NIFTY BANK", "SENSEX": "BSE:SENSEX"}
INDEX_PREFIX = {"NIFTY": "NIFTY", "BANKNIFTY": "BANKNIFTY", "SENSEX": "SENSEX"}
INDEX_EXCHANGE = {"NIFTY": "NFO", "BANKNIFTY": "NFO", "SENSEX": "BFO"}

STRIKE_WINDOW = 5       # ±5 strikes from ATM
REFRESH_INTERVAL = 60   # seconds between fetches
MARKET_START = "09:15"
MARKET_END = "15:30"
TIMEZONE = "Asia/Kolkata"

# =====================================================================
# MODELS
# =====================================================================

@dataclass
class StrikeAnalysis:
    strike: int
    ce_oi: float = 0.0
    pe_oi: float = 0.0
    ce_delta: float = 0.0
    pe_delta: float = 0.0
    net_delta: float = 0.0
    flow: str = "Neutral"
    ce_cmp: float = 0.0
    pe_cmp: float = 0.0
    ce_vwap: float = 0.0
    pe_vwap: float = 0.0
    vwap_signal: str = ""
    pcr: float = 0.0
    is_atm: bool = False
    atm_marker: str = ""
    is_support: bool = False
    is_resistance: bool = False


@dataclass
class AnalysisResult:
    index: str
    spot: float
    atm: int
    support: int
    resistance: int
    support_shift: str | None = None
    resistance_shift: str | None = None
    strikes: list[StrikeAnalysis] = field(default_factory=list)
    total_net_delta: float = 0.0
    overall_flow: str = "Neutral"
    index_vwap: str = ""
    index_pcr: float = 0.0
    timestamp: datetime = field(default_factory=datetime.now)

# =====================================================================
# KITE CONNECTOR
# =====================================================================

class KiteClient:
    def __init__(self, api_key: str, access_token: str) -> None:
        self.kite = KiteConnect(api_key=api_key)
        self.kite.set_access_token(access_token)
        self._instruments_cache: dict[str, pd.DataFrame] = {}

    def get_spot_prices(self, indices: list[str]) -> dict[str, float]:
        symbols = [INDEX_SYMBOLS[idx] for idx in indices]
        quotes = self.kite.ltp(symbols)
        return {idx: float(quotes[INDEX_SYMBOLS[idx]]["last_price"]) for idx in indices}

    @staticmethod
    def calc_atm(spot: float, index: str) -> int:
        interval = STRIKE_INTERVALS[index]
        return int(round(spot / interval) * interval)

    def get_instruments(self, index: str) -> pd.DataFrame:
        if index in self._instruments_cache:
            return self._instruments_cache[index]

        exchange = INDEX_EXCHANGE[index]
        raw = self.kite.instruments(exchange)
        df = pd.DataFrame(raw)

        df = df[df["name"] == INDEX_PREFIX[index]].copy()
        df = df[df["instrument_type"].isin(["CE", "PE"])]
        df["expiry"] = pd.to_datetime(df["expiry"])

        today = datetime.now().date()
        future = df[df["expiry"].dt.date >= today]["expiry"].unique()
        if len(future) == 0:
            raise RuntimeError(f"No future expiries found for {index}")

        df = df[df["expiry"] == min(future)].copy()
        self._instruments_cache[index] = df
        return df

    def get_option_chain(self, index: str, atm: int, window: int) -> pd.DataFrame:
        interval = STRIKE_INTERVALS[index]
        instruments = self.get_instruments(index)
        strikes = [atm + i * interval for i in range(-window, window + 1)]
        selected = instruments[instruments["strike"].isin(strikes)].copy()

        if selected.empty:
            return pd.DataFrame()

        exchange = INDEX_EXCHANGE[index]
        symbols = [f"{exchange}:{ts}" for ts in selected["tradingsymbol"]]
        quotes = self.kite.quote(symbols)

        rows = []
        for _, inst in selected.iterrows():
            key = f"{exchange}:{inst['tradingsymbol']}"
            q = quotes.get(key, {})
            rows.append({
                "strike": int(inst["strike"]),
                "type": inst["instrument_type"],
                "oi": q.get("oi", 0),
                "last_price": q.get("last_price", 0.0),
                "volume": q.get("volume", 0),
            })
        return pd.DataFrame(rows)

    def get_index_quote(self, index: str) -> dict:
        symbol = INDEX_SYMBOLS[index]
        quotes = self.kite.quote([symbol])
        return quotes.get(symbol, {})

# =====================================================================
# OI FLOW STRATEGY
# =====================================================================

class OIFlowStrategy:
    def __init__(self) -> None:
        self._prev_oi: dict[tuple[str, int, str], float] = {}
        self._prev_support: dict[str, int | None] = {}
        self._prev_resistance: dict[str, int | None] = {}
        self._prev_atm: dict[str, int | None] = {}
        self._vwap_accum: dict[tuple[str, int, str], dict[str, float]] = {}

    def analyse(self, index: str, spot: float, atm: int,
                chain: pd.DataFrame, index_quote: dict) -> AnalysisResult:
        if chain.empty:
            return AnalysisResult(index=index, spot=spot, atm=atm, support=atm, resistance=atm)

        strikes_in_range = sorted(chain["strike"].unique())
        strike_data: dict[int, StrikeAnalysis] = {
            s: StrikeAnalysis(strike=s, is_atm=(s == atm)) for s in strikes_in_range
        }

        # ── OI deltas ──
        for _, row in chain.iterrows():
            strike = int(row["strike"])
            opt_type = row["type"]
            oi = float(row["oi"])
            ltp = float(row["last_price"])
            volume = int(row["volume"])

            key = (index, strike, opt_type)
            prev = self._prev_oi.get(key, oi)
            delta = oi - prev
            self._prev_oi[key] = oi

            # VWAP accumulator
            if key not in self._vwap_accum:
                self._vwap_accum[key] = {"cum_pv": 0.0, "cum_vol": 0.0}
            self._vwap_accum[key]["cum_pv"] += ltp * volume
            self._vwap_accum[key]["cum_vol"] += volume
            acc = self._vwap_accum[key]
            vwap = round(acc["cum_pv"] / acc["cum_vol"], 2) if acc["cum_vol"] > 0 else 0.0

            sa = strike_data.get(strike)
            if sa is None:
                continue
            if opt_type == "CE":
                sa.ce_oi, sa.ce_delta, sa.ce_cmp, sa.ce_vwap = oi, delta, ltp, vwap
            else:
                sa.pe_oi, sa.pe_delta, sa.pe_cmp, sa.pe_vwap = oi, delta, ltp, vwap

        # ── Per-strike metrics ──
        for sa in strike_data.values():
            sa.net_delta = sa.pe_delta - sa.ce_delta

            if sa.pe_delta > 0 and sa.ce_delta < 0:
                sa.flow = "Bullish"
            elif sa.ce_delta > 0 and sa.pe_delta < 0:
                sa.flow = "Bearish"
            elif abs(sa.net_delta) > 0:
                sa.flow = "Bullish" if sa.net_delta > 0 else "Bearish"
            else:
                sa.flow = "Neutral"

            avg_cmp = (sa.ce_cmp + sa.pe_cmp) / 2 if (sa.ce_cmp + sa.pe_cmp) > 0 else 0
            avg_vwap = (sa.ce_vwap + sa.pe_vwap) / 2 if (sa.ce_vwap + sa.pe_vwap) > 0 else 0
            if avg_vwap > 0:
                if avg_cmp > avg_vwap * 1.005:
                    sa.vwap_signal = "🟢"
                elif avg_cmp < avg_vwap * 0.995:
                    sa.vwap_signal = "🔴"
                else:
                    sa.vwap_signal = "🔼"
            else:
                sa.vwap_signal = "—"

            sa.pcr = round(sa.pe_oi / sa.ce_oi, 2) if sa.ce_oi > 0 else 0.0

        # ── Support & Resistance ──
        ce_map = {sa.strike: sa.ce_oi for sa in strike_data.values()}
        pe_map = {sa.strike: sa.pe_oi for sa in strike_data.values()}
        resistance = max(ce_map, key=ce_map.get)  # type: ignore
        support = max(pe_map, key=pe_map.get)  # type: ignore
        strike_data[support].is_support = True
        strike_data[resistance].is_resistance = True

        # ── Shift detection ──
        prev_sup = self._prev_support.get(index)
        prev_res = self._prev_resistance.get(index)
        prev_atm = self._prev_atm.get(index)

        support_shift = f"{prev_sup} → {support}" if prev_sup and support != prev_sup else None
        resistance_shift = f"{prev_res} → {resistance}" if prev_res and resistance != prev_res else None

        # ── ATM color ──
        for sa in strike_data.values():
            if sa.strike == atm:
                sa.atm_marker = "🟢" if (prev_atm is None or prev_atm == atm) else "🔵"
            elif prev_atm is not None and sa.strike == prev_atm:
                sa.atm_marker = "🟠"

        # ── Index-level ──
        total_net_delta = round(sum(sa.net_delta for sa in strike_data.values()), 2)
        overall_flow = "Bullish" if total_net_delta > 0 else "Bearish" if total_net_delta < 0 else "Neutral"

        total_ce = sum(sa.ce_oi for sa in strike_data.values())
        total_pe = sum(sa.pe_oi for sa in strike_data.values())
        index_pcr = round(total_pe / total_ce, 2) if total_ce > 0 else 0.0

        ohlc = index_quote.get("ohlc", {})
        idx_ltp = index_quote.get("last_price", 0)
        idx_vwap_approx = (ohlc.get("high", 0) + ohlc.get("low", 0) + ohlc.get("close", 0)) / 3 if ohlc else 0
        index_vwap = ("🟢" if idx_ltp > idx_vwap_approx else "🔴") if idx_vwap_approx > 0 else "—"

        # ── Save state ──
        self._prev_support[index] = support
        self._prev_resistance[index] = resistance
        self._prev_atm[index] = atm

        return AnalysisResult(
            index=index, spot=spot, atm=atm,
            support=support, resistance=resistance,
            support_shift=support_shift, resistance_shift=resistance_shift,
            strikes=sorted(strike_data.values(), key=lambda s: s.strike),
            total_net_delta=total_net_delta, overall_flow=overall_flow,
            index_vwap=index_vwap, index_pcr=index_pcr,
        )

# =====================================================================
# DISPLAY
# =====================================================================

RST = "\033[0m"
B = "\033[1m"
DM = "\033[2m"
GR = "\033[32m"
RD = "\033[31m"
YL = "\033[33m"
CY = "\033[36m"
WH = "\033[37m"


def _fd(val: float) -> str:
    s = f"{val:+.1f}"
    if val > 0:   return f"{RD}{s}{RST}"
    if val < 0:   return f"{GR}{s}{RST}"
    return f"{DM}{s}{RST}"


def print_analysis(r: AnalysisResult) -> None:
    ts = r.timestamp.strftime("%H:%M:%S")

    print(f"\n{'=' * 60}")
    print(f"{B}{CY}{r.index}{RST}  {DM}TIME:{RST} {ts}  {DM}SPOT:{RST} {B}{r.spot:.2f}{RST}  "
          f"{DM}ATM:{RST} {r.atm}  {DM}VWAP:{RST} {r.index_vwap}  {DM}PCR:{RST} {r.index_pcr}")
    print(f"{'─' * 60}")
    print(f"  {GR}Support:{RST} {r.support}  {RD}Resistance:{RST} {r.resistance}")

    if r.support_shift:
        print(f"  {YL}Support shifted:{RST} {r.support_shift}")
    if r.resistance_shift:
        print(f"  {YL}Resistance shifted:{RST} {r.resistance_shift}")

    print()
    print(f"{DM}  {'Strike':<14} {'CE_Δ':>8} {'PE_Δ':>8} {'Net_Δ':>8} {'Flow':<10} {'CMP':>8} {'VWAP':<6} {'PCR':>6}{RST}")
    print(f"  {'─' * 72}")

    for s in r.strikes:
        label = ""
        if s.is_support:    label += "S "
        if s.is_resistance: label += "R "
        if s.atm_marker:    label += s.atm_marker + " "
        label += str(s.strike)

        fc = GR if s.flow == "Bullish" else RD if s.flow == "Bearish" else DM
        cmp = round((s.ce_cmp + s.pe_cmp) / 2, 1) if (s.ce_cmp + s.pe_cmp) > 0 else 0

        print(f"  {label:<14} {_fd(s.ce_delta):>8} {_fd(s.pe_delta):>8} {_fd(s.net_delta):>8} "
              f"{fc}{s.flow:<10}{RST} {cmp:>8.1f} {s.vwap_signal:<6} {s.pcr:>6.2f}")

    print(f"  {'─' * 72}")
    fc = GR if r.overall_flow == "Bullish" else RD if r.overall_flow == "Bearish" else WH
    print(f"  {B}TOTAL NET Δ:{RST} {fc}{r.total_net_delta:+.2f}{RST}  {B}FLOW:{RST} {fc}{r.overall_flow}{RST}")
    print(f"{'=' * 60}\n")

# =====================================================================
# MAIN
# =====================================================================

def is_market_open() -> bool:
    tz = pytz.timezone(TIMEZONE)
    now = datetime.now(tz)
    start = now.replace(hour=int(MARKET_START.split(":")[0]), minute=int(MARKET_START.split(":")[1]), second=0, microsecond=0)
    end = now.replace(hour=int(MARKET_END.split(":")[0]), minute=int(MARKET_END.split(":")[1]), second=0, microsecond=0)
    return start <= now <= end


def main() -> None:
    print("=" * 50)
    print("  MONIES — OI Flow Analyser")
    print("=" * 50)

    # Credentials
    api_key = os.environ.get("KITE_API_KEY", "").strip() or input("Enter KITE_API_KEY: ").strip()
    access_token = os.environ.get("KITE_ACCESS_TOKEN", "").strip() or input("Enter KITE_ACCESS_TOKEN: ").strip()

    if not api_key or not access_token:
        print("ERROR: Both KITE_API_KEY and KITE_ACCESS_TOKEN are required.")
        sys.exit(1)

    # Index selection
    all_indices = ["NIFTY", "BANKNIFTY", "SENSEX"]
    env_indices = os.environ.get("INDICES", "").strip()

    if env_indices:
        indices = [s.strip().upper() for s in env_indices.split(",") if s.strip().upper() in all_indices]
    else:
        print("\n  1. NIFTY  2. BANKNIFTY  3. SENSEX  4. All (default)")
        choice = input("Select (e.g. 1,2 or Enter for all): ").strip()
        if not choice or choice == "4":
            indices = all_indices
        else:
            m = {"1": "NIFTY", "2": "BANKNIFTY", "3": "SENSEX"}
            indices = [m[c.strip()] for c in choice.split(",") if c.strip() in m] or all_indices

    # Connect
    print(f"\nConnecting to Kite...")
    client = KiteClient(api_key, access_token)

    try:
        prices = client.get_spot_prices(indices)
        for idx, price in prices.items():
            print(f"  {idx}: {price:.2f}")
        print("Connected!\n")
    except Exception as e:
        print(f"ERROR: Failed to connect — {e}")
        sys.exit(1)

    print(f"Tracking: {', '.join(indices)}")
    print(f"Strike window: ±{STRIKE_WINDOW} | Refresh: {REFRESH_INTERVAL}s | Hours: {MARKET_START}–{MARKET_END} IST")
    print("\nLoading instruments...")

    for idx in indices:
        inst = client.get_instruments(idx)
        print(f"  {idx}: {len(inst)} contracts")

    strategy = OIFlowStrategy()
    tick = 0

    print(f"\n{'─' * 50}")
    print("Analysis loop started (Ctrl+C to stop)")
    print(f"{'─' * 50}")

    try:
        while True:
            if not is_market_open():
                tz = pytz.timezone(TIMEZONE)
                now = datetime.now(tz).strftime("%H:%M:%S")
                print(f"\r[{now}] Market closed. Waiting...", end="", flush=True)
                time.sleep(30)
                continue

            tick += 1
            try:
                spot_prices = client.get_spot_prices(indices)
                for idx in indices:
                    spot = spot_prices[idx]
                    atm = KiteClient.calc_atm(spot, idx)
                    chain = client.get_option_chain(idx, atm, STRIKE_WINDOW)
                    index_quote = client.get_index_quote(idx)
                    result = strategy.analyse(idx, spot, atm, chain, index_quote)
                    print_analysis(result)
            except KeyboardInterrupt:
                raise
            except Exception as e:
                print(f"\n[ERROR] Tick {tick}: {e}")

            time.sleep(REFRESH_INTERVAL)

    except KeyboardInterrupt:
        print(f"\n\nStopped after {tick} ticks. Goodbye!")


if __name__ == "__main__":
    main()
