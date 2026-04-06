# Monies — OI Flow Analyser

Live options OI analysis for **NIFTY, BANKNIFTY, SENSEX**.

Tracks OI deltas, flow direction, CMP, VWAP, PCR, support/resistance, shift detection, and ATM movement — all from a single Python file.

---

## Prerequisites

- **Python 3.12+**
- **uv** — fast Python package manager
- A **Zerodha Kite Connect** API key and access token
- Get your access token from the [Monies web app](https://signal.dataprism.in) (Google sign-in → Connect Kite → copy token)

### Install uv

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# Or via Homebrew
brew install uv
```

After installing, restart your terminal or run `source $HOME/.local/bin/env`.

---

## Run locally (with uv)

```bash
cd analyser
make setup        # copies .env.example → .env + installs deps
# edit .env with your KITE_API_KEY and KITE_ACCESS_TOKEN
make run          # starts the analyser
```

Or manually:

```bash
cd analyser
uv sync
cp .env.example .env
# fill in .env
uv run analyser.py
```

---

## Run on Google Colab

### Step 1 — Install dependencies

```python
!pip install kiteconnect pandas pytz python-dotenv
```

### Step 2 — Upload `analyser.py`

Click the **folder icon** in Colab's left sidebar → click the **upload button** → select `analyser.py`.

### Step 3 — Set credentials and run

```python
import os
os.environ["KITE_API_KEY"] = "your_api_key_here"
os.environ["KITE_ACCESS_TOKEN"] = "your_access_token_here"
os.environ["INDICES"] = "NIFTY,BANKNIFTY,SENSEX"
```

```python
!python analyser.py
```

> If you skip the env vars, the script will prompt you to enter them interactively.

---

## What it shows

```
============================================================
NIFTY  TIME: 10:33:00  SPOT: 25502.30  ATM: 25500  VWAP: 🟢  PCR: 1.2
────────────────────────────────────────────────────────────
  Support: 25200  Resistance: 25800
  Resistance shifted: 25700 → 25800

  Strike         CE_Δ     PE_Δ    Net_Δ Flow       CMP    VWAP    PCR
  ────────────────────────────────────────────────────────────────────
  S 25400         -0.7     +4.1     +4.8 Bullish    210.0 🟢      2.30
  🟠 25450        -0.5     +2.0     +2.5 Bullish    165.0 🟢      1.80
  🔵 25500        -0.2     +1.8     +2.0 Bullish    120.0 🔼      1.50
  25550           +0.3     +1.2     +0.9 Bullish     90.0 🔴      1.20
  R 25600         +1.5     -0.5     -2.0 Bearish    210.0 🔴      0.60
  ────────────────────────────────────────────────────────────────────
  TOTAL NET Δ: +8.20  FLOW: Bullish
============================================================
```

| Column | Meaning |
|--------|---------|
| **CE_Δ / PE_Δ** | OI change since last tick |
| **Net_Δ** | PE_Δ - CE_Δ (positive = bullish) |
| **Flow** | Bullish / Bearish / Neutral |
| **CMP** | Average option price (CE + PE) / 2 |
| **VWAP** | 🟢 above VWAP, 🔴 below, 🔼 near |
| **PCR** | Put-Call Ratio per strike |
| **S / R** | Support (max PE OI) / Resistance (max CE OI) |
| **🟢 🔵 🟠** | ATM unchanged / ATM shifted here / was ATM last tick |

---

## Configuration

Edit `.env` or set environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `KITE_API_KEY` | — | Your Kite Connect API key |
| `KITE_ACCESS_TOKEN` | — | Access token from Monies app |
| `INDICES` | `NIFTY,BANKNIFTY,SENSEX` | Which indices to track |

Constants in `analyser.py` (top of file):

| Constant | Default | Description |
|----------|---------|-------------|
| `STRIKE_WINDOW` | `5` | ±N strikes from ATM |
| `REFRESH_INTERVAL` | `60` | Seconds between fetches |
| `MARKET_START` | `09:15` | IST |
| `MARKET_END` | `15:30` | IST |
