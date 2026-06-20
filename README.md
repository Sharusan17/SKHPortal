# SKHPortal

The web platform for **SKH Inc** — a Lancashire automotive group with six specialist
divisions: Prestige Motors, Finance, Detailing, Rental, Mechanic and Customs.

Built with **Next.js** (App Router + TypeScript). Application data will live in a
standalone **PostgreSQL** database (Railway, viewed in pgAdmin) via **Prisma**, with
**Supabase** handling authentication. See [`ROADMAP.md`](ROADMAP.md) for the full plan.

## Status — Phase 1

The foundation is live: the main group portal and the **SKH Prestige Motors** showroom
page, both recreating the approved design prototypes in [`project/`](project).

| Route | Page |
|-------|------|
| `/` | SKH Inc group portal (hero, six-division grid, closing CTA) |
| `/prestige` | Prestige Motors showroom (search, stock grid, finance example, car-detail modal) |

Forms currently behave as in the prototype (client-side). Live persistence to Postgres
and email notifications land once the database is provisioned.

## Getting started

```bash
npm install
cp .env.example .env   # fill in values as services are provisioned
npm run dev            # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run lint`.

## Project layout

```
app/                 Next.js App Router routes
  page.tsx           main portal (+ hub.css)
  prestige/          Prestige Motors page (+ PrestigeApp.tsx, prestige.css)
  globals.css        shared brand design system
components/          shared UI (StarMark, SiteFooter, HubEffects)
lib/                 data + helpers (cars.ts)
docs/                roadmap specs and the original design handoff note
project/             design prototypes (source of truth for the visuals)
```
