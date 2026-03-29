# Product Overview

## What is Monies?

Monies is a real-time options open-interest signal engine for Indian equity indices. It connects to Zerodha Kite, streams live options tick data for NIFTY, BANKNIFTY, and SENSEX, and produces directional trading signals based on OI flow analysis.

## Problem

Options open interest data changes rapidly during market hours. Manually tracking OI shifts across multiple strikes, indices, and timeframes is impractical. Traders need automated, real-time analysis that synthesizes OI movements into actionable directional signals.

## Solution

Monies automates the full pipeline:

1. **Connects** to Zerodha Kite via OAuth and WebSocket
2. **Streams** live tick data for ATM +/- 5 strike options
3. **Aggregates** OI changes into 1-minute bars, then derives 3-minute and 5-minute views
4. **Evaluates** a multi-timeframe weighted voting strategy (Template D)
5. **Emits** LONG_BIAS / SHORT_BIAS / NEUTRAL signals with confidence scores
6. **Delivers** signals in real time to a web dashboard via SSE

## Scope

- **Alerts only** -- no order placement or execution
- **Indian indices only** -- NIFTY, BANKNIFTY, SENSEX
- **Options OI only** -- does not analyze futures, price action, or order book
- **Single strategy** -- Template D (configurable weights and thresholds)
- **Single data source** -- Zerodha Kite API

## Users

Individual options traders using Zerodha who want real-time OI-based directional signals during market hours (9:15 AM - 3:30 PM IST).

## Key Metrics

- **Signal** -- directional bias: LONG_BIAS, SHORT_BIAS, or NEUTRAL
- **Confidence** -- 0.0 to 1.0 score based on delta magnitude and timeframe consensus
- **Total Delta** -- absolute sum of CE and PE OI deltas at 1-minute level
- **Weighted Total Delta** -- delta weighted across 1m/3m/5m timeframes
- **Timeframe Votes** -- per-timeframe direction (e.g., "1m:LONG,3m:LONG,5m:NEUTRAL")
