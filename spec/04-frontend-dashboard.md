# Frontend Dashboard

## Overview

SignalEdge is a Next.js 15 app with a multi-page dashboard for monitoring real-time trading signals across multiple strategies. Dark theme, Jotai for state, shadcn/ui components.

## Route Structure

```
/login                          — Google sign-in page (public)
/invite                         — Invite code entry (public, post-Google OAuth)
/(dashboard)/                   — Overview: all strategies summary
/(dashboard)/strategy/[id]      — Per-strategy signal feed, charts, details
/(dashboard)/settings           — App settings
```

All dashboard routes are protected by `src/middleware.ts` — unauthenticated users are redirected to `/login`.

## Dashboard Layout

The `(dashboard)` route group uses `DashboardShell` as a persistent layout:

```
+------------------+------------------------------------------+
| Sidebar          | Top Header                                |
|                  | (title, SSE status, user avatar, sign out)|
| Navigation:      +------------------------------------------+
| • Overview       |                                           |
| • Template D     |   <page content>                          |
| • OI Momentum    |                                           |
| • PCR Shift      |                                           |
|                  |                                           |
| ─────────────────|                                           |
| Kite Disconnected|                                           |
+------------------+------------------------------------------+
| Bottom Tab Bar (mobile)                                      |
+--------------------------------------------------------------+
```

`DashboardShell` runs two hooks for its entire lifetime (no teardown on page navigation):
- `useInitialData()` — fetches signals history, auth status, active runs, strategy list
- `useSSEStream()` — one persistent SSE connection, feeds all strategy pages

## SSE Connection

The SSE connection lives in `DashboardShell` and persists across all page navigations.

```
DashboardShell (mounted once per session)
  └── useSSEStream()
        1. GET /api/proxy/stream-token   (Next.js verifies session, issues 60s HMAC token)
        2. EventSource → FastAPI /api/signals/stream?stream_token=<token>
        3. Incoming signal → signalsByStrategy[signal.strategy_id]
        4. On error: close, wait 3s, fetch new token, reconnect
```

Each strategy page reads its own slice from `signalsByStrategy` — no per-page connections.

## Pages

### `/` — Overview

Aggregate view across all strategies:
- Stat cards: total signals, active strategies, Kite status, SSE status
- Per-strategy summary cards (recent signals, run status, stop button)
- Recent signals feed across all strategies

### `/strategy/[strategyId]` — Strategy Detail

Three-tab view for a single strategy:

| Tab | Content |
|-----|---------|
| Signals | Filterable table: All / Long / Short / Neutral |
| Charts | Visual confidence and delta charts |
| Details | Strategy config, run info, performance stats |

**On mount**: reads `signalsByStrategy[strategyId]` from Jotai (already populated by `DashboardShell`).

### `/settings` — Settings

App configuration and invite code management.

## Auth Pages

### `/login`

- Centered card, dark background
- "Sign in with Google" button
- Shows error banner for `BackendUnavailable` or `AccessDenied` errors (URL `?error=` param)

### `/invite`

- Entered after Google OAuth for first-time users
- Pre-filled email shown from URL search params
- Invite code input → `POST /api/proxy/users/register`
- On success: triggers Google sign-in again to complete session creation

## State Management

**File**: `src/store.ts` — Jotai atoms

| Atom | Type | Description |
|------|------|-------------|
| `signalsByStrategyAtom` | `Record<string, Signal[]>` | Signals grouped by strategy_id (max 100 each) |
| `allSignalsAtom` | `Signal[]` | Derived: flat sorted list across all strategies |
| `activeRunsAtom` | `ActiveRun[]` | All currently active runs |
| `activeStrategyIdsAtom` | `string[]` | Derived: IDs of running/starting runs |
| `strategiesAtom` | `Strategy[]` | Strategy catalog from backend |
| `authStatusAtom` | `AuthStatus \| null` | Kite broker connection state |
| `sseConnectedAtom` | `boolean` | SSE stream connection state |
| `signalFilterIndexAtom` | `string \| null` | Active index filter |
| `signalFilterDirectionAtom` | `SignalDirection \| null` | Active direction filter |

## Components

### Layout (`src/components/layout/`)

| Component | Description |
|-----------|-------------|
| `DashboardShell` | Root layout wrapper, runs `useInitialData` + `useSSEStream` |
| `AppSidebar` | Left nav with strategy links, Kite status |
| `TopHeader` | Title, SSE badge, user avatar, sign-out button |
| `BottomTabBar` | Mobile navigation bar |

### Dashboard (`src/components/dashboard/`)

| Component | Description |
|-----------|-------------|
| `StatCard` | KPI metric card with icon and optional variant color |
| `SignalTable` | Paginated/filtered signal list |
| `StrategyOverviewCard` | Per-strategy summary card on Overview page |
| `StrategyPickerDialog` | Modal to select and start a new strategy |
| `StatusDot` | Pulsing colored indicator dot |

## Hooks

| Hook | Location | Description |
|------|----------|-------------|
| `useSSEStream` | `DashboardShell` | Persistent SSE connection with auto-reconnect |
| `useInitialData` | `DashboardShell` | One-time fetch of all initial state |
| `useStrategyActions` | Various | `handleKiteLogin`, `handleStartStrategy`, `handleStopRun` |

## Styling

- **Theme**: Dark (`#0a0a0a` background)
- **Framework**: Tailwind CSS v4
- **Components**: shadcn/ui (Card, Button, Badge, Table, Dialog, Sidebar)
- **Icons**: Lucide React
- **Fonts**: Geist Sans + Geist Mono
- **Responsive**: Sidebar hidden on mobile, bottom tab bar shown instead
