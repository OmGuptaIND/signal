# API Reference

## Base URL

```
http://127.0.0.1:8000
```

Configurable via `NEXT_PUBLIC_BACKEND_URL` on the frontend.

## CORS

All origins allowed in development. CORS middleware is configured in `api/__init__.py`.

---

## Health

### `GET /health`

Returns server health status.

**Response**: `200 OK`
```json
{"status": "ok"}
```

---

## Authentication

### `GET /kite/login-url`

Returns the Zerodha Kite OAuth login URL.

**Response**: `200 OK`
```json
{"login_url": "https://kite.zerodha.com/connect/login?v=3&api_key=XXX"}
```

### `GET /kite/callback`

OAuth callback endpoint. Kite redirects here after user login.

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `request_token` | string | Token from Kite OAuth flow |
| `action` | string | Should be "login" |
| `status` | string | Should be "success" |

**Behavior**: Exchanges request token for access token, saves to `.env`, starts a strategy run, redirects browser to frontend.

**Response**: `200 OK` (HTML redirect to `FRONTEND_BASE_URL`)

### `GET /kite/connectivity`

Tests live Kite API connectivity by fetching a quote.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `config_path` | string | `config.yaml` | Path to config file |
| `env_path` | string | `.env` | Path to env file |

**Response**: `200 OK`
```json
{
  "status": "ok",
  "last_price": 23450.25,
  "latency_ms": 142,
  "auth_mode": "access_token"
}
```

### `GET /kite/credentials-status`

Returns which credential types are present (no secret values).

**Response**: `200 OK`
```json
{
  "api_key_present": true,
  "api_secret_present": true,
  "access_token_present": true,
  "access_token_only_mode": true,
  "request_token_present": false
}
```

---

## Auth Status

### `GET /api/auth/status`

Returns current Kite authentication state.

**Response**: `200 OK`
```json
{
  "is_connected": true,
  "message": "Connected via access token",
  "last_updated_at": "2026-03-29T09:15:00+05:30"
}
```

---

## Signals

### `GET /api/signals/stream`

Server-Sent Events stream of live signals. Keeps connection open.

**Event format**:
```
event: new_signal
data: {"id":42,"timestamp":"2026-03-29T12:30:45+05:30","index_name":"NIFTY","signal":"LONG_BIAS","confidence":0.82,"total_delta":45.3,"weighted_total_delta":38.1,"timeframe_votes":"1m:LONG,3m:LONG,5m:NEUTRAL","spot_price":23450.25,"atm_strike":23450,"reason":"CE delta > PE delta across 1m & 3m"}
```

### `GET /api/signals/history`

Returns the most recent 50 signals from the database.

**Response**: `200 OK`
```json
{
  "signals": [
    {
      "id": 42,
      "timestamp": "2026-03-29T12:30:45+05:30",
      "index_name": "NIFTY",
      "signal": "LONG_BIAS",
      "confidence": 0.82,
      "total_delta": 45.3,
      "weighted_total_delta": 38.1,
      "timeframe_votes": "1m:LONG,3m:LONG,5m:NEUTRAL",
      "spot_price": 23450.25,
      "atm_strike": 23450,
      "reason": "CE delta > PE delta across 1m & 3m"
    }
  ]
}
```

---

## Runs

### `GET /api/runs`

Returns the most recent 20 strategy runs.

**Response**: `200 OK`
```json
{
  "runs": [
    {
      "id": 1,
      "status": "running",
      "started_at": "2026-03-29T09:15:00+05:30",
      "stopped_at": null,
      "token_expires_at": "2026-03-30T06:00:00+05:30",
      "error_message": null,
      "signals_count": 42
    }
  ]
}
```

### `GET /api/runs/active`

Returns the currently active strategy run, or null.

**Response**: `200 OK`
```json
{"run": { ... }}
```

### `POST /api/runs/start`

Starts a new strategy run.

**Request body**:
```json
{
  "access_token": "kite_access_token",
  "api_key": "kite_api_key",
  "api_secret": "kite_api_secret"
}
```

**Response**: `200 OK`
```json
{"run": { ... }}
```

### `POST /api/runs/{run_id}/stop`

Stops a running strategy.

**Response**: `200 OK`
```json
{"run": { ... }}
```

---

## Signal Object Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Auto-increment primary key |
| `timestamp` | ISO 8601 | When the signal was generated |
| `index_name` | string | `NIFTY`, `BANKNIFTY`, or `SENSEX` |
| `signal` | string | `LONG_BIAS`, `SHORT_BIAS`, or `NEUTRAL` |
| `confidence` | float | 0.0 to 1.0 confidence score |
| `total_delta` | float | Absolute sum of CE + PE OI deltas (1m) |
| `weighted_total_delta` | float | Weighted delta across timeframes |
| `timeframe_votes` | string | Per-timeframe votes (e.g., "1m:LONG,3m:LONG,5m:NEUTRAL") |
| `spot_price` | float | Underlying index price at signal time |
| `atm_strike` | integer | At-the-money strike price |
| `reason` | string | Human-readable strategy evaluation detail |

## Strategy Run Object Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Auto-increment primary key |
| `status` | string | `starting`, `running`, `stopped`, `expired`, `error` |
| `started_at` | ISO 8601 | Run start time |
| `stopped_at` | ISO 8601 / null | Run stop time |
| `token_expires_at` | ISO 8601 | When the Kite access token expires |
| `error_message` | string / null | Error detail if status is "error" |
| `signals_count` | integer | Number of signals emitted during this run |
