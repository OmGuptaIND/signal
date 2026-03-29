# Authentication Flow

## Overview

Monies authenticates with Zerodha Kite via OAuth 2.0. The flow involves the frontend initiating login, the user authenticating on Kite's site, and the backend exchanging tokens and starting a strategy run.

## Flow

```
User                Frontend              Backend               Kite
 |                    |                     |                    |
 |-- Click Connect -->|                     |                    |
 |                    |-- GET /api/auth/kite |                   |
 |                    |                     |-- GET /kite/login-url
 |                    |                     |<-- {login_url}     |
 |                    |<-- redirect --------|                    |
 |<-- redirect to Kite login page -------->|                    |
 |                    |                     |                    |
 |-- Login on Kite ---|---------------------|------ login ------>|
 |                    |                     |<-- callback -------|
 |                    |                     |    ?request_token=X|
 |                    |                     |                    |
 |                    |                     |-- exchange token -->|
 |                    |                     |<-- access_token ---|
 |                    |                     |                    |
 |                    |                     |-- save to .env     |
 |                    |                     |-- start run        |
 |                    |                     |-- update auth status
 |                    |<-- redirect to / ---|                    |
 |<-- dashboard w/ live signals ---------->|                    |
```

## Step-by-Step

### 1. Initiate Login

- User clicks "Connect Kite" button in the dashboard header
- Frontend calls `GET /api/auth/kite` (Next.js API route)
- Next.js route proxies to backend `GET /kite/login-url`
- Backend generates Kite login URL using `KiteConnect.login_url()`
- Frontend redirects the user's browser to Kite's login page

### 2. User Authenticates

- User enters Zerodha credentials on `kite.zerodha.com`
- On success, Kite redirects to the configured callback URL:
  `http://127.0.0.1:8000/kite/callback?request_token=XXX&action=login&status=success`

### 3. Token Exchange

- Backend receives the callback with `request_token` query parameter
- Calls `KiteConnect.generate_session(request_token, api_secret)` to get `access_token`
- Persists `KITE_ACCESS_TOKEN` to the backend `.env` file
- Updates `kite_auth_status` table: `is_connected=true`

### 4. Auto-Start Strategy Run

- After successful token exchange, backend automatically calls `RunManager.start_run()`
- Creates a `strategy_runs` record with status "starting"
- Spawns an async engine task that:
  - Loads the instruments master list from Kite
  - Resolves subscription tokens for options contracts
  - Opens a WebSocket connection for live tick streaming
  - Begins processing ticks into signals

### 5. Redirect to Dashboard

- Backend returns an HTML response that redirects the browser to `FRONTEND_BASE_URL`
- Dashboard loads, connects to SSE stream, and begins receiving signals

## Token Lifecycle

- Kite access tokens expire daily at **6:00 AM IST**
- `token_expires_at` is computed at run creation time
- If the token expires during a run, the engine task detects the expiry and stops the run with status "expired"
- User must re-authenticate to start a new run

## Auth Status

The `kite_auth_status` table is a singleton that tracks:

| Field | Type | Description |
|-------|------|-------------|
| is_connected | boolean | Whether Kite is currently authenticated |
| last_updated_at | datetime | Last state change timestamp |
| message | string | Human-readable status message |

Frontend polls `GET /api/auth/status` to display connection state in the header.

## Alternative Auth Modes

For development/testing, the backend supports bypassing OAuth:

1. **Pre-generated token**: Set `KITE_ACCESS_TOKEN` and `KITE_ACCESS_TOKEN_ONLY=true` in `.env`
2. **Manual token**: Use `make generate-access-token` to generate and save a token via CLI
