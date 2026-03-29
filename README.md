# Monies

Real-time options open-interest signal engine for Indian equity indices. Streams live market data from Zerodha Kite, computes OI features across multiple timeframes, evaluates trading strategies, and delivers signals to a live dashboard.

## What It Does

Monies watches options open interest for **NIFTY**, **BANKNIFTY**, and **SENSEX** in real time. It aggregates tick-level OI data into 1-minute, 3-minute, and 5-minute features, runs them through a weighted voting strategy (Template D), and emits directional signals (LONG_BIAS, SHORT_BIAS, NEUTRAL) with confidence scores. Signals stream to a dark-themed React dashboard via SSE.

This is an **alerts-only** engine -- it does not place orders.

## Architecture

```
Zerodha Kite WebSocket
        |
        v
  [Tick Queue]  ──>  OI Aggregator (1m bars)
                          |
                          v
                   Timeframe Buffer (1m/3m/5m)
                          |
                          v
                   Template D Strategy
                          |
                          v
                   Alert Sink (PostgreSQL)
                          |
                          v
                   SSE Broadcaster  ──>  React Dashboard
```

## Tech Stack

| Layer    | Tech |
|----------|------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4, Jotai, shadcn/ui |
| Backend  | Python 3.11+, FastAPI, SQLAlchemy 2.0, Alembic |
| Data     | Zerodha Kite WebSocket + REST API (kiteconnect SDK) |
| Database | PostgreSQL |
| Realtime | Server-Sent Events (SSE) |

## Project Structure

```
Monies/
├── backend/                    # Python FastAPI strategy engine
│   ├── src/stock_strategy/
│   │   ├── api/                # REST + SSE endpoints
│   │   ├── strategy/           # Template D + base interface
│   │   ├── engine.py           # Core evaluation loop
│   │   ├── oi_aggregator.py    # Tick -> 1m OI features
│   │   ├── timeframes.py       # 1m -> 3m/5m derivation
│   │   ├── run_manager.py      # Strategy run lifecycle
│   │   ├── alerts.py           # DB sink with dedup
│   │   ├── kite_client.py      # Kite WebSocket wrapper
│   │   └── models_db.py        # SQLAlchemy tables
│   ├── migrations/             # Alembic DB migrations
│   ├── tests/
│   ├── config.yaml             # Strategy hyperparameters
│   └── Makefile
│
├── frontend/                   # Next.js dashboard
│   ├── src/
│   │   ├── app/                # Pages + API routes (auth proxy)
│   │   ├── components/         # Dashboard UI + shadcn/ui
│   │   ├── store.ts            # Jotai global state
│   │   └── lib/                # Types + utils
│   └── package.json
│
└── spec/                       # Product & technical specs
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 12+
- Zerodha Kite API credentials ([kite.trade](https://kite.trade))
- `uv` package manager (for Python)

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set KITE_API_KEY, KITE_API_SECRET, DATABASE_URL, FRONTEND_BASE_URL

make install        # uv sync
make db-upgrade     # run migrations
make dev            # start API on :8000
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env: set NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000

npm install
npm run dev         # start on :3000
```

### 3. Connect & Trade

1. Open http://localhost:3000
2. Click **Connect Kite** and log in with Zerodha
3. Backend automatically starts a strategy run
4. Signals stream to the dashboard in real time

## Environment Variables

### Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `KITE_API_KEY` | Yes | Zerodha Kite API key |
| `KITE_API_SECRET` | Yes | Zerodha Kite API secret |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `FRONTEND_BASE_URL` | Yes | Frontend URL for OAuth redirect (e.g. `http://localhost:3000`) |
| `KITE_ACCESS_TOKEN` | No | Pre-generated access token (skips OAuth) |
| `KITE_ACCESS_TOKEN_ONLY` | No | Set `true` to use only the access token |
| `LOG_LEVEL` | No | `DEBUG`, `INFO`, `WARNING`, `ERROR` (default: `INFO`) |
| `LOG_JSON` | No | `true` for JSON-formatted logs |
| `LOG_FILE` | No | File path for rotating log output |
| `DRY_RUN` | No | Informational flag (alerts-only mode) |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | Yes | Backend API base URL |

## Strategy Configuration

Edit `backend/config.yaml`:

```json
{
  "symbols": ["NIFTY", "BANKNIFTY", "SENSEX"],
  "strike_window": 5,
  "template_d": {
    "weights": {"1m": 0.5, "3m": 0.3, "5m": 0.2},
    "min_oi_delta": 1.0,
    "signal_threshold": 0.12,
    "min_consensus_weight": 0.5,
    "confidence_scale": 2.5
  }
}
```

- **weights**: Timeframe voting weights (must sum to 1.0)
- **signal_threshold**: Minimum weighted score to emit a signal
- **min_oi_delta**: Minimum absolute OI delta to consider directional
- **dedup_confidence_delta**: Skip signal if confidence change < this value

## Useful Commands

```bash
# Backend (from backend/)
make dev                      # Start API with auto-reload
make test                     # Run test suite
make lint                     # Ruff linter
make run-live                 # Start live engine
make run-replay REPLAY_INPUT=data/replay_sample.csv
make check-kite-api           # Test Kite connectivity
make generate-access-token    # Generate and save access token
make db-upgrade               # Apply pending migrations
make db-migrate m="desc"      # Create new migration

# Frontend (from frontend/)
npm run dev                   # Dev server
npm run build                 # Production build
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/kite/login-url` | Get Kite OAuth login URL |
| GET | `/kite/callback` | OAuth callback (handles token exchange) |
| GET | `/kite/connectivity` | Test Kite API connection |
| GET | `/api/signals/stream` | SSE stream of live signals |
| GET | `/api/signals/history` | Last 50 signals from DB |
| GET | `/api/auth/status` | Kite connection status |
| GET | `/api/runs` | List recent strategy runs |
| GET | `/api/runs/active` | Current active run |
| POST | `/api/runs/start` | Start a new strategy run |
| POST | `/api/runs/{id}/stop` | Stop a running strategy |

## Database

Three tables managed by Alembic migrations:

- **kite_auth_status** -- Singleton Kite connection state
- **strategy_runs** -- Run lifecycle (status, timestamps, token expiry, signal count)
- **alert_signals** -- Persisted signals (index, signal type, confidence, deltas, spot price, reason)

## License

Private.
