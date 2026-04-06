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
  - ATM color tracking

Usage:
    cd analyser
    cp .env.example .env   # fill in your keys
    uv run analyser.py
"""

from __future__ import annotations

import os
import sys
import time
import select
import threading
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

STRIKE_WINDOW = 5       # +/- 5 strikes from ATM
POLL_INTERVAL = 30      # seconds between API polls (~7 calls/poll, well within 3 req/s limit)
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
    oi_changed: bool = False  # True if any OI actually changed from prev tick
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class Snapshot:
    """One complete tick — all indices at one point in time."""
    tick: int
    timestamp: datetime
    results: dict[str, AnalysisResult] = field(default_factory=dict)

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
        self.tick_count = 0

    def analyse(self, index: str, spot: float, atm: int,
                chain: pd.DataFrame, index_quote: dict) -> AnalysisResult:
        if chain.empty:
            return AnalysisResult(index=index, spot=spot, atm=atm, support=atm, resistance=atm)

        strikes_in_range = sorted(chain["strike"].unique())
        strike_data: dict[int, StrikeAnalysis] = {
            s: StrikeAnalysis(strike=s, is_atm=(s == atm)) for s in strikes_in_range
        }

        # -- OI deltas --
        any_oi_changed = False
        for _, row in chain.iterrows():
            strike = int(row["strike"])
            opt_type = row["type"]
            oi = float(row["oi"])
            ltp = float(row["last_price"])
            volume = int(row["volume"])

            key = (index, strike, opt_type)
            prev = self._prev_oi.get(key)
            delta = (oi - prev) if prev is not None else 0.0
            if prev is not None and oi != prev:
                any_oi_changed = True
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

        # -- Per-strike metrics --
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

        # -- Support & Resistance --
        ce_map = {sa.strike: sa.ce_oi for sa in strike_data.values()}
        pe_map = {sa.strike: sa.pe_oi for sa in strike_data.values()}
        resistance = max(ce_map, key=ce_map.get)  # type: ignore
        support = max(pe_map, key=pe_map.get)  # type: ignore
        strike_data[support].is_support = True
        strike_data[resistance].is_resistance = True

        # -- Shift detection --
        prev_sup = self._prev_support.get(index)
        prev_res = self._prev_resistance.get(index)
        prev_atm = self._prev_atm.get(index)

        support_shift = f"{prev_sup} → {support}" if prev_sup and support != prev_sup else None
        resistance_shift = f"{prev_res} → {resistance}" if prev_res and resistance != prev_res else None

        # -- ATM color --
        for sa in strike_data.values():
            if sa.strike == atm:
                sa.atm_marker = "🟢" if (prev_atm is None or prev_atm == atm) else "🔵"
            elif prev_atm is not None and sa.strike == prev_atm:
                sa.atm_marker = "🟠"

        # -- Index-level --
        total_net_delta = round(sum(sa.net_delta for sa in strike_data.values()), 2)
        overall_flow = "Bullish" if total_net_delta > 0 else "Bearish" if total_net_delta < 0 else "Neutral"

        total_ce = sum(sa.ce_oi for sa in strike_data.values())
        total_pe = sum(sa.pe_oi for sa in strike_data.values())
        index_pcr = round(total_pe / total_ce, 2) if total_ce > 0 else 0.0

        ohlc = index_quote.get("ohlc", {})
        idx_ltp = index_quote.get("last_price", 0)
        idx_vwap_approx = (ohlc.get("high", 0) + ohlc.get("low", 0) + ohlc.get("close", 0)) / 3 if ohlc else 0
        index_vwap = ("🟢" if idx_ltp > idx_vwap_approx else "🔴") if idx_vwap_approx > 0 else "—"

        # -- Save state --
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
            oi_changed=any_oi_changed,
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
BG_BLU = "\033[44m"
BG_GRN = "\033[42m"
BG_RED = "\033[41m"


def _fd(val: float) -> str:
    s = f"{val:+.1f}"
    if val > 0:   return f"{RD}{s}{RST}"
    if val < 0:   return f"{GR}{s}{RST}"
    return f"{DM}{s}{RST}"


def clear_screen() -> None:
    os.system("cls" if os.name == "nt" else "clear")


def render_snapshot(snap: Snapshot, total_ticks: int, indices: list[str],
                    countdown: int | None = None) -> str:
    """Build the full screen output for a snapshot as a string."""
    lines: list[str] = []

    # -- Top bar --
    ts = snap.timestamp.strftime("%H:%M:%S")
    is_latest = snap.tick == total_ticks
    tag = f"{BG_GRN}{B} LIVE {RST}" if is_latest else f"{BG_BLU}{B} HISTORY {RST}"

    timer = ""
    if countdown is not None and is_latest:
        timer = f"  {YL}Next tick in {countdown}s{RST}"

    lines.append(f"{B}MONIES{RST}  {tag}  Tick {snap.tick}/{total_ticks}  {DM}{ts}{RST}{timer}")
    lines.append(f"{DM}← prev (p)  next (n) →  latest (l)  quit (q){RST}")
    lines.append("")

    for idx in indices:
        r = snap.results.get(idx)
        if r is None:
            continue

        # -- Index header --
        fc = GR if r.overall_flow == "Bullish" else RD if r.overall_flow == "Bearish" else WH
        stale = "" if r.oi_changed else f"  {DM}(OI unchanged){RST}"
        lines.append(f"{B}{CY}{r.index}{RST}  SPOT {B}{r.spot:.2f}{RST}  ATM {r.atm}  "
                      f"VWAP {r.index_vwap}  PCR {r.index_pcr}  "
                      f"NET {fc}{r.total_net_delta:+.1f}{RST}  {fc}{r.overall_flow}{RST}{stale}")

        sr = f"  S:{GR}{r.support}{RST}  R:{RD}{r.resistance}{RST}"
        if r.support_shift:
            sr += f"  {YL}S moved {r.support_shift}{RST}"
        if r.resistance_shift:
            sr += f"  {YL}R moved {r.resistance_shift}{RST}"
        lines.append(sr)

        # -- Table --
        lines.append(f"  {DM}{'Strike':<13} {'CE_Δ':>7} {'PE_Δ':>7} {'Net_Δ':>7} {'Flow':<9} {'CMP':>7} {'VW':<4} {'PCR':>5}{RST}")

        for s in r.strikes:
            label = ""
            if s.is_support:    label += "S "
            if s.is_resistance: label += "R "
            if s.atm_marker:    label += s.atm_marker + " "
            label += str(s.strike)

            sfc = GR if s.flow == "Bullish" else RD if s.flow == "Bearish" else DM
            cmp = round((s.ce_cmp + s.pe_cmp) / 2, 1) if (s.ce_cmp + s.pe_cmp) > 0 else 0

            # Highlight ATM row
            prefix = "  "
            if s.is_atm:
                prefix = f" {B}>"

            ce_d = f"{s.ce_delta:+.0f}" if abs(s.ce_delta) >= 0.5 else f"{s.ce_delta:+.1f}"
            pe_d = f"{s.pe_delta:+.0f}" if abs(s.pe_delta) >= 0.5 else f"{s.pe_delta:+.1f}"
            net_d = f"{s.net_delta:+.0f}" if abs(s.net_delta) >= 0.5 else f"{s.net_delta:+.1f}"

            # Color deltas
            ce_c = RD if s.ce_delta > 0 else GR if s.ce_delta < 0 else DM
            pe_c = RD if s.pe_delta > 0 else GR if s.pe_delta < 0 else DM
            net_c = GR if s.net_delta > 0 else RD if s.net_delta < 0 else DM

            row = (f"{prefix}{label:<13} {ce_c}{ce_d:>7}{RST} {pe_c}{pe_d:>7}{RST} "
                   f"{net_c}{net_d:>7}{RST} {sfc}{s.flow:<9}{RST} {cmp:>7.1f} {s.vwap_signal:<4} {s.pcr:>5.2f}")
            if s.is_atm:
                row += RST
            lines.append(row)

        lines.append("")

    return "\n".join(lines)


def display_snapshot(snap: Snapshot, total_ticks: int, indices: list[str],
                     countdown: int | None = None) -> None:
    """Clear screen and render a snapshot."""
    clear_screen()
    print(render_snapshot(snap, total_ticks, indices, countdown))


# =====================================================================
# MAIN
# =====================================================================

def is_market_open() -> bool:
    tz = pytz.timezone(TIMEZONE)
    now = datetime.now(tz)
    start = now.replace(hour=int(MARKET_START.split(":")[0]), minute=int(MARKET_START.split(":")[1]), second=0, microsecond=0)
    end = now.replace(hour=int(MARKET_END.split(":")[0]), minute=int(MARKET_END.split(":")[1]), second=0, microsecond=0)
    return start <= now <= end


def read_key_nonblocking() -> str | None:
    """Read a single keypress without blocking (Unix only). Returns None if no input."""
    try:
        import termios
        import tty
        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setraw(fd)
            rlist, _, _ = select.select([sys.stdin], [], [], 0.1)
            if rlist:
                return sys.stdin.read(1)
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
    except (ImportError, OSError):
        # Colab / Windows fallback — no interactive navigation
        pass
    return None


def main() -> None:
    print(f"{B}MONIES — OI Flow Analyser{RST}\n")

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
        print("  1. NIFTY  2. BANKNIFTY  3. SENSEX  4. All (default)")
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
        print("Connected!")
    except Exception as e:
        print(f"ERROR: Failed to connect — {e}")
        sys.exit(1)

    print(f"\nLoading instruments...")
    for idx in indices:
        inst = client.get_instruments(idx)
        print(f"  {idx}: {len(inst)} contracts")

    strategy = OIFlowStrategy()
    history: list[Snapshot] = []
    view_index = -1  # -1 = follow latest
    tick = 0
    poll_count = 0

    print(f"\nPolling every {POLL_INTERVAL}s — new tick created when OI changes")
    print(f"Starting in 3s... (Ctrl+C to stop)")
    time.sleep(3)

    def fetch_snapshot() -> Snapshot:
        """Fetch data for all indices and return a Snapshot."""
        snap = Snapshot(tick=0, timestamp=datetime.now())
        spot_prices = client.get_spot_prices(indices)
        for idx in indices:
            spot = spot_prices[idx]
            atm = KiteClient.calc_atm(spot, idx)
            chain = client.get_option_chain(idx, atm, STRIKE_WINDOW)
            index_quote = client.get_index_quote(idx)
            result = strategy.analyse(idx, spot, atm, chain, index_quote)
            snap.results[idx] = result
        return snap

    def any_oi_changed(snap: Snapshot) -> bool:
        """Check if any index in this snapshot had OI changes."""
        return any(r.oi_changed for r in snap.results.values())

    def handle_key(key: str) -> None:
        """Handle navigation keypresses."""
        nonlocal view_index
        total = len(history)
        if total == 0:
            return
        current = view_index if view_index >= 0 else total - 1

        if key == "p" or key == "h":
            current = max(0, current - 1)
            view_index = current
        elif key == "n":
            if current < total - 1:
                current += 1
                view_index = current
            else:
                view_index = -1
        elif key == "l":
            view_index = -1
            current = total - 1

        display_snapshot(history[current if view_index >= 0 else total - 1], total, indices)

    try:
        while True:
            if not is_market_open():
                clear_screen()
                tz = pytz.timezone(TIMEZONE)
                now = datetime.now(tz).strftime("%H:%M:%S")
                print(f"{B}MONIES{RST}  [{now}] Market closed. Waiting for {MARKET_START} IST...")
                time.sleep(30)
                continue

            # -- Poll for new data --
            poll_count += 1

            try:
                snap = fetch_snapshot()
            except KeyboardInterrupt:
                raise
            except Exception as e:
                clear_screen()
                print(f"[ERROR] Poll {poll_count}: {e}")
                time.sleep(POLL_INTERVAL)
                continue

            oi_changed = any_oi_changed(snap)

            if oi_changed or tick == 0:
                # OI changed — save as new tick
                tick += 1
                snap.tick = tick
                history.append(snap)

                if view_index == -1:
                    display_snapshot(snap, len(history), indices)
            else:
                # OI unchanged — just update the countdown on current display
                if view_index == -1 and history:
                    secs_left = POLL_INTERVAL
                    display_snapshot(history[-1], len(history), indices, countdown=secs_left)

            # -- Wait until next poll, listening for keys --
            deadline = time.time() + POLL_INTERVAL
            last_countdown = POLL_INTERVAL
            while time.time() < deadline:
                key = read_key_nonblocking()
                if key == "q":
                    raise KeyboardInterrupt
                elif key is not None:
                    handle_key(key)
                    continue

                # Update countdown every second if on live view
                remaining = max(0, int(deadline - time.time()))
                if view_index == -1 and history and remaining != last_countdown:
                    last_countdown = remaining
                    display_snapshot(history[-1], len(history), indices, countdown=remaining)

    except KeyboardInterrupt:
        clear_screen()
        print(f"\n{B}Stopped after {tick} ticks ({poll_count} polls).{RST}")

        if len(history) > 1:
            print(f"\n{CY}Review mode{RST} — {len(history)} snapshots saved")
            print(f"  {DM}p = prev  n = next  l = latest  q = quit{RST}\n")

            pos = len(history) - 1
            display_snapshot(history[pos], len(history), indices)

            while True:
                key = read_key_nonblocking()
                if key is None:
                    continue
                if key == "q":
                    break
                elif key == "p" or key == "h":
                    pos = max(0, pos - 1)
                elif key == "n":
                    pos = min(len(history) - 1, pos + 1)
                elif key == "l":
                    pos = len(history) - 1
                display_snapshot(history[pos], len(history), indices)

        print(f"\nGoodbye!")


if __name__ == "__main__":
    main()
