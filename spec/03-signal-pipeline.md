# Signal Pipeline

## Overview

The signal pipeline transforms raw options tick data from Kite WebSocket into actionable trading signals. It flows through four stages: tick ingestion, OI aggregation, multi-timeframe derivation, and strategy evaluation.

## Pipeline Stages

```
Kite WebSocket Ticks
        |
        v
  1. Tick Queue (bounded, 50k max)
        |
        v
  2. OI Aggregator (groups by minute)
        |
        v
  3. Timeframe Buffer (1m -> 3m, 5m)
        |
        v
  4. Strategy Evaluation (Template D)
        |
        v
  5. Alert Sink (dedup + persist)
        |
        v
  6. SSE Broadcast (to dashboard)
```

## Stage 1: Tick Ingestion

**File**: `kite_client.py`, `run_manager.py`

- Kite WebSocket pushes ticks for all subscribed instruments
- Each tick contains: `instrument_token`, `last_price`, `oi`, `timestamp`
- Ticks are enqueued into an async bounded queue (max 50,000 items)
- The engine consumer loop drains the queue and routes ticks to the aggregator

**Subscribed instruments**: ATM +/- `strike_window` (default 5) CE and PE options for each index.

## Stage 2: OI Aggregation

**File**: `oi_aggregator.py`

Ticks are grouped into 1-minute bars. At each minute boundary, the aggregator computes:

| Feature | Formula | Description |
|---------|---------|-------------|
| `ce_oi_total` | Sum of CE OI across subscribed strikes | Total call open interest |
| `pe_oi_total` | Sum of PE OI across subscribed strikes | Total put open interest |
| `ce_oi_delta` | Current CE OI total - Previous CE OI total | Change in call OI |
| `pe_oi_delta` | Current PE OI total - Previous PE OI total | Change in put OI |
| `imbalance` | CE activity / PE activity ratio | Directional skew |
| `momentum` | Direction and strength of delta | Trend indicator |

Output: A `FeatureSnapshot` for each index at each minute.

## Stage 3: Multi-Timeframe Derivation

**File**: `timeframes.py`

The `TimeframeBuffer` maintains a rolling window of 1-minute snapshots and derives higher timeframes:

- **3-minute**: Average of the last 3 one-minute bars
- **5-minute**: Average of the last 5 one-minute bars

Each timeframe produces its own feature set (CE/PE deltas, imbalance, momentum).

The buffer requires a minimum number of bars before emitting:
- 3m requires at least 3 bars
- 5m requires at least 5 bars

## Stage 4: Strategy Evaluation (Template D)

**File**: `strategy/template_d.py`, `engine.py`

Template D is a weighted multi-timeframe voting strategy:

### Per-Timeframe Vote

For each timeframe (1m, 3m, 5m):
1. Check if `abs(ce_oi_delta)` or `abs(pe_oi_delta)` exceeds `min_oi_delta` threshold
2. If CE delta > PE delta -> vote LONG
3. If PE delta > CE delta -> vote SHORT
4. Otherwise -> vote NEUTRAL

### Weighted Scoring

```
weighted_score = (1m_vote * 0.5) + (3m_vote * 0.3) + (5m_vote * 0.2)
```

Where LONG = +1, SHORT = -1, NEUTRAL = 0.

### Signal Emission

- If `weighted_score > signal_threshold` (0.12): emit **LONG_BIAS**
- If `weighted_score < -signal_threshold`: emit **SHORT_BIAS**
- Otherwise: emit **NEUTRAL**

### Confidence Calculation

```
confidence = min(abs(weighted_score) * confidence_scale, 1.0)
```

Where `confidence_scale` default is 2.5.

## Stage 5: Alert Deduplication & Persistence

**File**: `alerts.py`

Before persisting, signals are deduplicated:

- For each index, compare new signal confidence to last emitted confidence
- If `abs(new_confidence - last_confidence) < dedup_confidence_delta` (0.1), skip
- Otherwise, persist to `alert_signals` table and increment run's `signals_count`

## Stage 6: SSE Broadcast

**File**: `events.py`, `api/signals.py`

- A background `DatabasePoller` task polls the `alert_signals` table for new rows
- New signals are broadcast via `Broadcaster` to all connected SSE clients
- Frontend `EventSource` receives `new_signal` events and prepends to the signal list
- Dashboard maintains a maximum of 50 signals in memory

## Signal Object

```json
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
  "reason": "CE delta > PE delta across 1m & 3m, consensus 2/3"
}
```

## Timing

- **Market hours**: 9:15 AM - 3:30 PM IST (configurable)
- **Compute interval**: 60 seconds (1-minute bars)
- **First 3m signal**: ~3 minutes after market open
- **First 5m signal**: ~5 minutes after market open
