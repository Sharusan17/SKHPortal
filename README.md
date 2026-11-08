# SKHPortal

The web platform for **SKH Inc**, a Lancashire automotive group with seven specialist divisions:
Prestige Motors, Finance, Detailing, Mechanic, Rental, Recovery and Custom.

A monorepo of three apps, each deployed as its own Railway service:

| App | What it is | Stack | Local URL |
|-----|-----------|-------|-----------|
| [`apps/web`](apps/web) | The public website: group portal, Prestige showroom, stock and car pages | Next.js (App Router, TypeScript) | http://localhost:3000 |
| [`apps/api`](apps/api) | The website's API: vehicles, enquiries, £99 reservations | Express + TypeScript, Prisma, PostgreSQL | http://localhost:3001 |
| [`apps/admin`](apps/admin) | The private back office at **`/admin`**: stock book, invoices, credit notes, expenses, bank, MTD VAT return | FastAPI (Python) + the shared PostgreSQL (own `admin` schema), React (Vite), admin sign-in | http://localhost:8501/admin |

The website forwards every `/admin/...` request to the admin service (`ADMIN_URL`), so the whole
platform lives on one domain. **Supabase** will handle customer sign-in in a later phase; see the
[roadmap](docs/ROADMAP.md).

## Repository layout

```
apps/
  web/        Next.js site
    app/          routes: /, /prestige, /prestige/stock, /prestige/stock/[slug], /divisions/[slug]
    components/   shared UI (Star, SiteFooter, PrestigeNav, CarCard, ...)
    lib/          API client, car and division data/helpers
    public/       logos and static assets
  api/        Express API
    src/          server (index.ts), routes/, Prisma client (db.ts)
    prisma/       schema.prisma, migrations/, seed.ts
  admin/      Back office (see apps/admin/README.md)
    api/          FastAPI server and accounting logic
    web/          React pages
docs/
  ROADMAP.md      product roadmap and phases
  specs/          per-phase design specs
  design/         design handoff note and the original HTML prototypes (source of truth for visuals)
```

## Getting started

Each app has its own `.env` (copied from its `.env.example`); there is no shared env file, so each
service only ever sees its own secrets.

```bash
# Website
cd apps/web && npm install && cp .env.example .env && npm run dev        # http://localhost:3000

# API (separate terminal)
cd apps/api && npm install && cp .env.example .env && npm run dev        # http://localhost:3001

# Admin (separate terminal) - see apps/admin/README.md for the sign-in settings
cd apps/admin && pip install -r requirements.txt && cp .env.example .env
cd web && npm install && npm run build && cd .. && python api/server.py   # http://localhost:8501/admin
```

With all three running, the admin is also at http://localhost:3000/admin.

## Checks

Before opening a pull request, build each app:

```bash
cd apps/admin/web && npm run build
cd apps/web && npm run build
cd apps/api && npm run build
```

## Deployment (Railway)

One Railway project, one service per app, plus one PostgreSQL shared by the API (`public` schema)
and the admin (`admin` schema):

| Service | Root directory | Watch paths | Notes |
|---------|----------------|-------------|-------|
| web | `apps/web` | `apps/web/**` | `NEXT_PUBLIC_API_URL`, `ADMIN_URL` (admin's private URL) |
| api | `apps/api` | `apps/api/**` | Dockerfile; `DATABASE_URL` from Postgres, `CORS_ORIGIN` |
| admin | `apps/admin` | `apps/admin/**` | Dockerfile; `DATABASE_URL` from Postgres, `PORT=8080`, sign-in variables; no volume, no public domain |

Watch paths mean a change only redeploys the app it touches.
