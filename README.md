# SKHPortal

The web platform for **SKH Inc** — a Lancashire automotive group with seven specialist
divisions: Prestige Motors, Finance, Detailing, Mechanic, Rental, Recovery and Custom.

A two-service monorepo:

- **`frontend/`** — the customer-facing site, built with **Next.js** (App Router + TypeScript).
- **`backend/`** — an **Express + TypeScript** API that owns the application database
  (standalone **PostgreSQL** on Railway, viewed in pgAdmin) via **Prisma**.

**Supabase** handles authentication (added in a later phase). Both services deploy on
**Railway**. See [`ROADMAP.md`](ROADMAP.md) for the full plan.

## Status — Phase 1

Live foundation: the SKH Inc group portal and the **SKH Prestige Motors** showroom,
recreating the approved design prototypes in [`project/`](project).

| Route (frontend) | Page |
|------------------|------|
| `/` | SKH Inc group portal (hero, seven-division grid, closing CTA) |
| `/prestige` | Prestige Motors home (search, featured cars, finance example) |
| `/prestige/stock` | Inventory — searchable/filterable car grid |
| `/prestige/stock/[slug]` | Individual car page (specs, reserve/enquire) |

The car data is still static (`frontend/lib/cars.ts`); Phase 2 moves it to the backend
Postgres. Enquiry forms currently behave as in the prototype; the backend
`POST /api/enquiries` endpoint is scaffolded and goes live once the database is wired.

## Getting started

```bash
# Frontend
cd frontend && npm install && cp .env.example .env && npm run dev   # http://localhost:3000

# Backend (separate terminal)
cd backend && npm install && cp .env.example .env && npm run dev    # http://localhost:3001
```

## Project layout

```
frontend/            Next.js app (the customer site)
  app/               App Router routes (portal, prestige, stock, car pages)
  components/        shared UI (Star, SiteFooter, PrestigeNav, CarCard, …)
  lib/               data + helpers (cars.ts)
backend/             Express + TypeScript API
  src/               server (index.ts), Prisma client (db.ts)
  prisma/            schema.prisma (Enquiry model)
docs/                roadmap specs and the original design handoff note
project/             design prototypes (source of truth for the visuals)
```
