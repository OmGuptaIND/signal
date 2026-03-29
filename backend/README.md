# Live OI Signal Engine (Kite, Alerts-Only)

Python strategy engine for `NIFTY`, `BANKNIFTY`, and `SENSEX` that computes options open-interest features on `1m`, `3m`, and `5m` context windows and emits alert signals.

## What this does
- Uses Kite data (no Sensibull integration in v1).
- Tracks options OI for ATM +/- configured strike window (default `5`).
- Computes 1-minute features and derives 3-minute/5-minute aggregates.
- Evaluates a configurable `Template D` strategy.
- Emits alerts to console and appends CSV logs.
- Includes replay mode for dry validation from historical feature snapshots.
- Uses `loguru` for structured, step-level runtime logging.
- Uses `asyncio` runtime orchestration for live tick processing and graceful shutdown.

## Project sections
- `src/stock_strategy/config.py`: config and env loading
- `src/stock_strategy/kite_client.py`: Kite REST/websocket client wrapper
- `src/stock_strategy/instruments.py`: expiry/ATM/strike universe resolution
- `src/stock_strategy/oi_aggregator.py`: tick -> 1-minute OI features
- `src/stock_strategy/timeframes.py`: 1m -> 3m/5m derivation
- `src/stock_strategy/strategy/base.py`: strategy interface
- `src/stock_strategy/strategy/template_d.py`: configurable Template D scaffold
- `src/stock_strategy/engine.py`: core evaluation engine and stats
- `src/stock_strategy/alerts.py`: console + CSV sink with dedup
- `src/stock_strategy/replay.py`: replay runner
- `src/stock_strategy/main.py`: CLI entrypoint
- `tests/`: unit and replay tests

## Requirements
- Python `>=3.11`
- `uv` package manager

## Setup (`uv`)
```bash
uv venv
uv sync
```

If you want live Kite connectivity, install Kite SDK dependency:
```bash
uv add "kiteconnect>=5.0.0"
```

## Makefile workflow
Common shortcuts are available through [Makefile](/Users/omg/Desktop/Stock/Makefile):

```bash
make install            # uv sync
make install-all        # uv sync --extra kite
make requirements       # writes requirements.txt
make requirements-kite  # writes requirements-kite.txt
make test               # run test suite
make run-api            # start FastAPI service
make check-kite-api     # call local connectivity endpoint
make generate-access-token # generate and save KITE_ACCESS_TOKEN
make check-template-d   # run Template D alert case checks
```

## Configuration

### 1) Environment
Copy `.env.example` to `.env` and fill values:
```bash
cp .env.example .env
```

Fields:
- `KITE_API_KEY`
- `KITE_API_SECRET`
- `KITE_REDIRECTED_URL` (recommended: paste full redirected callback URL after Kite login)
- `KITE_REQUEST_TOKEN` (optional if you extracted it manually)
- `KITE_ACCESS_TOKEN` (optional; if provided, session generation is skipped)
- `KITE_ACCESS_TOKEN_ONLY` (recommended `true` once token is generated; disables fallback login/session flow)
- `DRY_RUN` (informational in this alerts-only build)
- `LOG_LEVEL`
- `LOG_JSON` (`true` for JSON logs, default `false`)
- `LOG_FILE` (optional path for rotating file logs, e.g. `logs/strategy.log`)

### 2) Strategy config
Edit `config.yaml` (JSON-compatible YAML in this version):
- `symbols`: `NIFTY`, `BANKNIFTY`, `SENSEX`
- `strike_window`: default `5`
- `market_start` / `market_end`: default `09:15` to `15:30` IST
- `csv_path`: output signal path
- `template_d`: rule thresholds + timeframe weights
  - `min_oi_delta`: minimum absolute CE/PE delta between timestamps to consider directional move
  - `signal_threshold`: minimum weighted score to trigger signal
  - `min_consensus_weight`: minimum directional timeframe weight for LONG/SHORT

## Run

### Live mode (alerts-only)
```bash
uv run python -m stock_strategy.main live --config config.yaml --env .env
```

### Replay mode
Prepare feature snapshot CSV with columns:
- `timestamp`
- `index`
- `spot_price`
- `atm_strike`
- `ce_oi_total`
- `pe_oi_total`
- `ce_oi_delta`
- `pe_oi_delta`
- `imbalance`
- `momentum`

Then run:
```bash
uv run python -m stock_strategy.main replay --config config.yaml --input data/replay_sample.csv
```

### Kite connectivity API test
Start the API:
```bash
make run-api
```

Get login URL:
```bash
curl "http://127.0.0.1:8000/kite/login-url?env_path=.env"
```

Important: set redirect URL in your Kite app to:
`http://127.0.0.1:8000/kite/callback`

After login, Kite redirects to `/kite/callback` and the API captures `request_token` in memory.

Then in another terminal, call:
```bash
curl "http://127.0.0.1:8000/kite/connectivity?env_path=.env&config_path=config.yaml"
```

Generate access token and save in `.env`:
```bash
make generate-access-token
```

To force all Kite calls to always use this token, set:
```env
KITE_ACCESS_TOKEN_ONLY=true
```
Then verify via diagnostics:
```bash
curl "http://127.0.0.1:8000/kite/credentials-status?env_path=.env"
```
Expected:
- `access_token_present: true`
- `access_token_only_mode: true`

Credential diagnostics (no secret values returned):
```bash
curl "http://127.0.0.1:8000/kite/credentials-status?env_path=.env"
```

Expected success response includes:
- `status: ok`
- `last_price` for selected symbol
- `latency_ms`
- `auth_mode`

## Output CSV schema (`csv_path`)
- `timestamp`
- `index`
- `signal` (`LONG_BIAS`, `SHORT_BIAS`, `NEUTRAL`)
- `confidence`
- `total_delta` (default: 1m `abs(CE delta) + abs(PE delta)`)
- `weighted_total_delta` (weighted across 1m/3m/5m)
- `timeframe_votes`
- `spot_price`
- `atm_strike`
- `reason`

## Tests
Run tests:
```bash
PYTHONPATH=src uv run python -m unittest discover -s tests -v
```

Validate required Template D alert cases:
```bash
make check-template-d
```

## Logging behavior
- All major stages are logged: config load, universe resolution, websocket lifecycle, minute aggregation, strategy evaluation, dedup decisions, replay summary.
- Console logging is enabled by default.
- Optional file logging with rotation is enabled when `LOG_FILE` is set.

## Async runtime model
- Live mode runs on `asyncio` with a bounded tick queue and non-blocking consumer loop.
- Websocket callbacks enqueue ticks safely into the event loop thread.
- Replay mode has an async wrapper (`run_replay_async`) so CLI orchestration remains async-native.

## Notes and limitations
- This is an alerts-only signal engine; no order placement.
- Template D is implemented as a configurable scaffold; tune thresholds/weights in `config.yaml`.
- Live mode assumes Kite websocket OI fields are available for selected option contracts.
- For Zerodha authentication, this project uses the official Python `kiteconnect` package and supports:
  - `API key + API secret + redirected URL` (auto-extracts `request_token`)
  - or `API key + API secret + request token`
  - or pre-generated `access token`
- Retail API throughput and internet latency prevent true exchange co-located HFT behavior.
- Current config parser expects JSON-compatible YAML syntax for `config.yaml`.
