# BidFrenzy

Mentimeter for live bidding. Hosts create auction rooms; participants join with a short code or QR and bid from their phones in real time.

## Stack

- Next.js (App Router) + React
- Supabase Auth (Google OAuth for hosts)
- Supabase Postgres + RLS + RPCs (`place_bid`, etc.)
- Supabase Realtime
- Vercel-ready frontend

## Setup

1. Copy env vars:

```bash
cp .env.example .env.local
```

2. Set your Supabase project values (Project Settings → API):

- `NEXT_PUBLIC_SUPABASE_URL=https://fwprwkkmaqenslyexwvg.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY=...` (for applying migrations / admin scripts)

3. Apply the schema in the Supabase SQL editor:

- Run [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql)

4. Enable Google Auth in Supabase:

- Authentication → Providers → Google
- Add redirect URL: `http://localhost:3000/auth/callback` (and your production URL)

5. Install and run:

```bash
npm install
npm run dev
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing |
| `/host/login` | Google OAuth for hosts |
| `/host` | Host dashboard |
| `/host/auctions/new` | Create auction |
| `/host/auctions/[id]` | Manage items |
| `/host/auctions/[id]/lobby` | QR + join code |
| `/host/auctions/[id]/live` | Live auction controls |
| `/host/auctions/[id]/summary` | Results |
| `/join` / `/join/[code]` | Participant experience |
| `/display/[code]` | Big-screen display |

## Demo path

Create auction → add items → Ready room → open Display → phones join → Start auction → Open bidding → compete → Close → Mark sold → Next item → Summary.
