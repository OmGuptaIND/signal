# Monies

Invite-only web app for Zerodha Kite token management + a standalone OI flow analyser for NIFTY, BANKNIFTY, and SENSEX.

## How it works

1. **Sign in** with Google (invite-only)
2. **Connect Kite** — redirects to Zerodha, exchanges token automatically
3. **Copy your access token** — use it in the analyser
4. **Run the analyser** — live OI flow, support/resistance, shift detection

## Project structure

```
Monies/
├── frontend/          # Next.js app (auth + Kite token)
│   ├── src/
│   │   ├── app/       # Pages: login, home, invite, admin
│   │   └── lib/       # NextAuth + Drizzle ORM
│   └── drizzle.config.ts
│
└── analyser/          # Python OI analyser (single file)
    ├── analyser.py    # Everything in one file
    ├── Makefile
    └── pyproject.toml # uv project
```

## Frontend — Token app

Next.js 15 app with Google OAuth, PostgreSQL invite system, and Kite Connect integration.

### Setup

```bash
cd frontend
cp .env.example .env   # fill in credentials
bun install
bun run db:push        # create database tables
bun run dev            # http://localhost:3000
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `NEXTAUTH_SECRET` | Session encryption key |
| `NEXTAUTH_URL` | App URL (`http://localhost:3000` or your domain) |
| `KITE_API_KEY` | Zerodha Kite API key |
| `KITE_API_SECRET` | Zerodha Kite API secret |
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_EMAIL` | First sign-in with this email becomes admin |

### Features

- Google sign-in with email allowlist (DB-backed)
- Invite code system — existing users can invite others
- Admin page (`/admin`) — manage users and invite codes
- Kite OAuth flow — token exchange via Next.js API routes
- Token display with one-click copy

## Analyser — OI flow engine

Single Python file that connects to Kite and runs live analysis.

### Run locally

```bash
cd analyser
make setup             # copies .env + installs deps via uv
# edit .env with your KITE_API_KEY and KITE_ACCESS_TOKEN
make run
```

### Run on Google Colab

```python
# Cell 1
!pip install kiteconnect pandas pytz python-dotenv

# Cell 2
import os
os.environ["KITE_API_KEY"] = "your_api_key"
os.environ["KITE_ACCESS_TOKEN"] = "paste_from_app"

# Cell 3 — upload analyser.py to Colab, then:
!python analyser.py
```

### What it tracks

- **OI deltas** — CE/PE open interest changes per strike
- **Flow** — Bullish / Bearish / Neutral per strike + overall
- **Support / Resistance** — max PE OI / max CE OI strikes
- **Shift detection** — S/R and ATM movement alerts
- **VWAP signals** — price vs VWAP per strike
- **PCR** — Put-Call Ratio per strike + index level
- **ATM tracking** — color-coded: 🟢 unchanged, 🔵 shifted, 🟠 previous

## Tech stack

| Component | Tech |
|-----------|------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Auth | NextAuth 5 (Google OAuth) |
| Database | PostgreSQL + Drizzle ORM |
| Analyser | Python 3.12+, kiteconnect, pandas |
| Package managers | bun (frontend), uv (analyser) |
