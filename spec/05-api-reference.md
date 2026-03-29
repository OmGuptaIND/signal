# API Reference

## Base URL

```
http://127.0.0.1:8000
```

Configured via `BACKEND_URL` in `frontend/.env` (server-side only — never exposed to the browser).

## Security

All `/api/*` routes require the `X-Internal-Key` header matching `BACKEND_INTERNAL_KEY`.
The Next.js proxy (`/api/proxy/[...path]`) adds this header after verifying the user's NextAuth session.

`/kite/*` routes are unprotected (Kite's OAuth servers call them directly).

`/api/signals/stream` uses short-lived stream token auth instead of the header (see SSE section below).

---

## Health

### `GET /health`

No auth required.

**Response**: `200 OK`
```json
{"status": "ok"}
```

---

## User Auth

### `POST /api/users/check`

Check whether a Google-authenticated email already has an account. Called by the NextAuth `signIn` callback.

**Request**:
```json
{"email": "user@example.com"}
```

**Response** (exists):
```json
{"exists": true, "user": {"id": 1, "email": "user@example.com", "name": "Alice", "image": "https://..."}}
```

**Response** (new user):
```json
{"exists": false}
```

### `POST /api/users/register`

Validate an invite code and create a new user account.

**Request**:
```json
{
  "email": "user@example.com",
  "name": "Alice",
  "image": "https://...",
  "google_id": "1234567890",
  "invite_code": "abc123xyz"
}
```

**Response** `200 OK`:
```json
{"success": true, "user": {"id": 1, "email": "user@example.com", "name": "Alice", "image": "https://..."}}
```

**Response** `400 Bad Request` (invalid/used code):
```json
{"detail": "Invalid or already used invite code"}
```

### `POST /api/invite-codes/generate`

Generate new invite codes (admin use).

**Request**:
```json
{"count": 5}
```

**Response**:
```json
{"codes": ["abc123", "def456", "ghi789", "jkl012", "mno345"]}
```

### `GET /api/invite-codes/mine`

List all invite codes with usage status.

**Response**:
```json
{
  "invite_codes": [
    {"id": 1, "code": "abc123", "used": true, "used_at": "2026-03-29T10:00:00Z", "created_at": "2026-03-28T09:00:00Z"},
    {"id": 2, "code": "def456", "used": false, "used_at": null, "created_at": "2026-03-28T09:00:00Z"}
  ]
}
```

---

## Kite Auth (Broker)

### `GET /kite/login-url`

Returns the Zerodha Kite OAuth login URL.

**Response**: `200 OK`
```json
{"login_url": "https://kite.zerodha.com/connect/login?v=3&api_key=XXX"}
```

### `GET /kite/callback`

OAuth callback — Kite redirects here after user login.

**Query Parameters**: `request_token`, `action`, `status`

**Behavior**: Exchanges request token → access token, saves to `.env`, starts a strategy run, redirects browser to `FRONTEND_BASE_URL`.

### `GET /kite/connectivity`

Tests live Kite API connectivity.

**Response**: `200 OK`
```json
{"status": "ok", "last_price": 23450.25, "latency_ms": 142, "auth_mode": "access_token"}
```

---

## Auth Status

### `GET /api/auth/status`

Returns current Kite broker authentication state.

**Response**: `200 OK`
```json
{"is_connected": true, "message": "Connected via access token", "last_updated_at": "2026-03-29T09:15:00+05:30"}
```

---

## Signals

### `GET /api/signals/stream`

Server-Sent Events stream. Requires `stream_token` query param (60-second HMAC token issued by `/api/proxy/stream-token`). No `X-Internal-Key` header required.

**Query Parameters**:
| Param | Required | Description |
|-------|----------|-------------|
| `stream_token` | Yes | Short-lived HMAC-SHA256 token |

**Event format**:
```
data: {"type":"new_signal","data":{...signal object...}}
```

**Error**: `401 Unauthorized` if token is invalid or expired.

### `GET /api/signals/history`

Returns the most recent 50 signals, optionally filtered by strategy.

**Query Parameters**:
| Param | Required | Description |
|-------|----------|-------------|
| `strategy_id` | No | Filter to a specific strategy |

**Response**: `200 OK`
```json
{
  "signals": [
    {
      "id": 42,
      "strategy_id": "template_d",
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

### `GET /api/runs/active`

Returns all currently active strategy runs.

**Response**: `200 OK`
```json
{"runs": [{...run object...}]}
```

### `POST /api/runs/start`

Starts a new strategy run.

**Request body**:
```json
{"access_token": "...", "api_key": "...", "api_secret": "...", "strategy_id": "template_d"}
```

**Response**: `200 OK`
```json
{"run": {...run object...}}
```

### `POST /api/runs/{run_id}/stop`

Stops a running strategy.

**Response**: `200 OK`
```json
{"run": {...run object...}}
```

---

## Next.js Proxy Routes

These are Next.js server routes — they verify the NextAuth session and forward to FastAPI.

| Route | Forwards to | Session required |
|-------|-------------|-----------------|
| `GET /api/proxy/stream-token` | — (issues token) | Yes |
| `GET /api/proxy/auth/status` | `GET /api/auth/status` | Yes |
| `GET /api/proxy/signals/history` | `GET /api/signals/history` | Yes |
| `GET /api/proxy/runs/active` | `GET /api/runs/active` | Yes |
| `POST /api/proxy/runs/start` | `POST /api/runs/start` | Yes |
| `POST /api/proxy/runs/{id}/stop` | `POST /api/runs/{id}/stop` | Yes |
| `POST /api/proxy/users/check` | `POST /api/users/check` | No (auth flow) |
| `POST /api/proxy/users/register` | `POST /api/users/register` | No (auth flow) |

---

## Signal Object Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Primary key |
| `strategy_id` | string | Source strategy identifier |
| `timestamp` | ISO 8601 | When the signal was generated |
| `index_name` | string | `NIFTY`, `BANKNIFTY`, or `SENSEX` |
| `signal` | string | `LONG_BIAS`, `SHORT_BIAS`, or `NEUTRAL` |
| `confidence` | float | 0.0–1.0 |
| `total_delta` | float | Absolute sum of CE + PE OI deltas (1m) |
| `weighted_total_delta` | float | Weighted delta across timeframes |
| `timeframe_votes` | string | Per-timeframe votes |
| `spot_price` | float | Underlying index price |
| `atm_strike` | integer | At-the-money strike |
| `reason` | string | Strategy evaluation detail |

## Strategy Run Object Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Primary key |
| `strategy_id` | string | Which strategy |
| `status` | string | `starting`, `running`, `stopped`, `expired`, `error` |
| `started_at` | ISO 8601 | Run start time |
| `stopped_at` | ISO 8601 / null | Run stop time |
| `token_expires_at` | ISO 8601 | When the Kite access token expires |
| `error_message` | string / null | Error detail if status is `error` |
| `signals_count` | integer | Number of signals emitted |
