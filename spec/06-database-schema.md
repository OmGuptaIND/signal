# Database Schema

## Overview

Monies uses PostgreSQL for persistence. Schema is managed by Alembic migrations in `backend/migrations/`.

## Tables

### `kite_auth_status`

Singleton table tracking Kite connection state. Always has exactly one row.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Always 1 |
| `is_connected` | BOOLEAN | DEFAULT false | Whether Kite is authenticated |
| `last_updated_at` | DATETIME (tz) | | Last state change |
| `message` | STRING | | Human-readable status |

### `strategy_runs`

Tracks the lifecycle of each strategy engine run.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Run identifier |
| `status` | STRING | NOT NULL | `starting`, `running`, `stopped`, `expired`, `error` |
| `started_at` | DATETIME (tz) | NOT NULL | When the run began |
| `stopped_at` | DATETIME (tz) | NULLABLE | When the run ended |
| `access_token` | STRING | | Kite token used for this run |
| `token_expires_at` | DATETIME (tz) | | Computed: next 6:00 AM IST |
| `error_message` | STRING | NULLABLE | Error detail if failed |
| `signals_count` | INTEGER | DEFAULT 0 | Count of signals emitted |

**Status transitions**:
```
starting -> running -> stopped
                    -> expired (token expired)
                    -> error (unhandled exception)
```

### `alert_signals`

Persisted trading signals produced by the strategy engine.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Signal identifier |
| `run_id` | INTEGER | FOREIGN KEY (strategy_runs.id), NULLABLE, INDEXED | Associated run |
| `timestamp` | DATETIME (tz) | INDEXED | When the signal was generated |
| `index_name` | STRING | INDEXED | `NIFTY`, `BANKNIFTY`, or `SENSEX` |
| `signal` | STRING | NOT NULL | `LONG_BIAS`, `SHORT_BIAS`, `NEUTRAL` |
| `confidence` | FLOAT | | 0.0 to 1.0 |
| `total_delta` | FLOAT | | abs(CE delta) + abs(PE delta) at 1m |
| `weighted_total_delta` | FLOAT | | Weighted across 1m/3m/5m |
| `timeframe_votes` | STRING | | e.g., "1m:LONG,3m:NEUTRAL,5m:SHORT" |
| `spot_price` | FLOAT | | Underlying index price |
| `atm_strike` | INTEGER | | At-the-money strike |
| `reason` | STRING | | Strategy evaluation detail |

**Indexes**: `timestamp`, `index_name`, `run_id`

## Migrations

Managed via Alembic. Common commands:

```bash
# Apply all pending migrations
make db-upgrade

# Create a new migration
make db-migrate m="add new column"

# Show migration history
make db-history

# Show current schema version
make db-current
```

Migration files live in `backend/migrations/versions/`.

## Connection

Configured via `DATABASE_URL` environment variable:

```
postgresql://user:password@localhost:5432/monies
```
