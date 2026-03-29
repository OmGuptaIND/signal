# Strategy Run Lifecycle

## Overview

A "run" represents a single session of the strategy engine processing live market data. Runs are managed by the `RunManager` and tracked in the `strategy_runs` table.

## States

```
          start_run()
              |
              v
         [starting]
              |
          engine init
          (instruments,
           websocket)
              |
              v
          [running]
              |
     +--------+--------+
     |        |        |
  stop_run() expired  error
     |        |        |
     v        v        v
 [stopped] [expired] [error]
```

| Status | Meaning |
|--------|---------|
| `starting` | Run created, engine initializing (loading instruments, opening websocket) |
| `running` | Engine is actively processing ticks and evaluating strategy |
| `stopped` | User or system stopped the run gracefully |
| `expired` | Kite access token expired (daily at 6 AM IST) |
| `error` | Unhandled exception during engine execution |

## Starting a Run

Triggered by:
1. **OAuth callback** -- automatic after successful token exchange
2. **Manual API call** -- `POST /api/runs/start` with credentials

Steps:
1. Create `strategy_runs` record (status: "starting")
2. Update `kite_auth_status` (is_connected: true)
3. Spawn async engine task:
   a. Initialize `KiteConnect` with access token
   b. Fetch instruments master list
   c. Resolve ATM strikes and subscription tokens
   d. Open WebSocket connection
   e. Update run status to "running"
   f. Begin tick processing loop

## During a Run

The engine task runs continuously:

1. Dequeue ticks from the bounded queue (50k max)
2. Route ticks to `OiAggregator` per index
3. At each minute boundary:
   - Compute 1m features
   - Feed to `TimeframeBuffer` for 3m/5m derivation
   - Call `strategy.evaluate()` with all available timeframes
   - If signal emitted: deduplicate and persist via `AlertSink`
4. Check for token expiry

## Stopping a Run

Triggered by:
1. **User action** -- `POST /api/runs/{id}/stop`
2. **Token expiry** -- detected in engine loop
3. **Unhandled error** -- caught at engine task level

Steps:
1. Cancel the async engine task
2. Close WebSocket connection
3. Update run status to "stopped" / "expired" / "error"
4. Set `stopped_at` timestamp
5. Update `kite_auth_status` (is_connected: false)

## Constraints

- Only **one run** can be active at a time
- Starting a new run while one is active will stop the existing run first
- Runs are scoped to a single Kite access token
- Token expiry is calculated as the next 6:00 AM IST from run start time

## Monitoring

- `GET /api/runs/active` -- check if a run is currently active
- `GET /api/runs` -- list recent runs with their status and signal counts
- Dashboard stat cards show run status in real time
