# Frontend Dashboard

## Overview

The frontend is a single-page Next.js 15 application that displays real-time trading signals. It uses a dark theme, connects to the backend via SSE for live updates, and manages state with Jotai atoms.

## Layout

```
+-------+--------------------------------------------------+
|       |  Header (title, auth badges, Connect button)     |
|       +--------------------------------------------------+
|  Side |                                                  |
|  bar  |  Stat Cards (4-column grid)                      |
|       |  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           |
|  Nav  |  │Total │ │Last  │ │Kite  │ │SSE   │           |
|       |  │Sigs  │ │Signal│ │Status│ │Status│           |
|       |  └──────┘ └──────┘ └──────┘ └──────┘           |
|       |                                                  |
|       |  Signal Table                                    |
|       |  ┌──────────────────────────────────────────┐   |
|       |  │ Time │ Index │ Signal │ Spot │ Conf │ ...│   |
|       |  │──────│───────│────────│──────│──────│────│   |
|       |  │ ...  │ ...   │ ...    │ ...  │ ...  │ ...│   |
|       |  └──────────────────────────────────────────┘   |
|       |                                                  |
|       |  Diagnostics Footer (4-column grid)              |
+-------+--------------------------------------------------+
```

## Pages

### `/` - Dashboard (Main Page)

The only active page. Renders the full signal monitoring interface.

**On mount**:
1. Fetches signal history from `GET /api/signals/history`
2. Fetches auth status from `GET /api/auth/status`
3. Fetches active run from `GET /api/runs/active`
4. Opens SSE connection to `GET /api/signals/stream`

## Components

### Sidebar (`components/dashboard/sidebar.tsx`)

- Fixed left panel, 220px wide
- Logo/brand at top
- Navigation links: Dashboard, Live Terminal, Settings (placeholder)
- Dark background with border

### Header (`components/dashboard/header.tsx`)

- Top bar spanning the main content area
- Displays: page title, Kite auth status badge, SSE connection badge
- "Connect Kite" / "Disconnect" button
- Auth status: green badge when connected, red when disconnected

### Stat Cards (`components/dashboard/stat-card.tsx`)

Four metric cards in a responsive grid:

| Card | Value | Source |
|------|-------|--------|
| Total Signals | Count of signals received | `signals.length` |
| Last Signal | Timestamp of most recent signal | `signals[0].timestamp` |
| Kite Status | Connected / Disconnected | Auth status API |
| SSE Status | Active / Inactive | EventSource state |

### Signal Table (`components/dashboard/signal-table.tsx`)

Scrollable table showing the latest 50 signals:

| Column | Display | Formatting |
|--------|---------|------------|
| Time | ISO timestamp | Locale string |
| Index | NIFTY / BANKNIFTY / SENSEX | Plain text |
| Signal | LONG_BIAS / SHORT_BIAS / NEUTRAL | Colored badge (green/red/gray) |
| Spot Price | Current underlying price | INR locale format |
| Confidence | 0-100% | Color-coded progress (green > yellow > red) |
| Total Delta | Absolute OI delta sum | Numeric |
| Weighted Delta | Weighted across timeframes | Numeric |
| Reason | Strategy evaluation detail | Truncated text |

### Status Dot (`components/dashboard/status-dot.tsx`)

Animated pulsing dot indicator used in the diagnostics footer and header badges.

- Green: connected/active
- Red: disconnected/error
- Gray: unknown/loading

## State Management

**File**: `store.ts`

Uses Jotai atoms for global state:

| Atom | Type | Purpose |
|------|------|---------|
| `signalsAtom` | `Signal[]` | Live signal list (max 50) |
| `authStatusAtom` | `AuthStatus` | Kite connection state |
| `activeRunAtom` | `StrategyRun \| null` | Current running strategy |
| `sseStatusAtom` | `"active" \| "inactive" \| "error"` | SSE connection state |

## SSE Connection

The dashboard page establishes an `EventSource` connection to `/api/signals/stream`:

1. On `new_signal` event: parse JSON, prepend to `signalsAtom`, cap at 50
2. On `open`: set SSE status to "active"
3. On `error`: set SSE status to "error", attempt reconnect

## Auth Interaction

### Connect Flow
1. User clicks "Connect Kite"
2. Frontend calls `GET /api/auth/kite` (Next.js route)
3. Route fetches login URL from backend and redirects browser
4. After OAuth, user returns to dashboard with active session

### Status Polling
- On page load, fetch `GET /api/auth/status`
- Display result in header badge and diagnostics section

## Styling

- **Theme**: Dark (zinc-900 background, zinc-800 cards, zinc-700 borders)
- **Framework**: Tailwind CSS 4 with utility classes
- **Components**: shadcn/ui (Button, Badge, Card, Table)
- **Icons**: Lucide React
- **Font**: System monospace stack
- **Responsive**: Grid adapts from 1 to 4 columns based on viewport

## Diagnostics Footer

Four-column grid at the bottom of the dashboard:

| Section | Shows |
|---------|-------|
| Auth State | Connection status, last updated time |
| SSE Status | Stream active/inactive, error details |
| Token Expiry | When current Kite token expires |
| Strategy | Current run status, signal alignment |
