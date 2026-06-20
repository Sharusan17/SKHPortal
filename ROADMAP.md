# SKHPortal — Product Roadmap

> Master plan for the SKH multi-division automotive web platform.
> **Status:** Draft for review · **Last updated:** 2026-06-20

---

## 1. Vision

SKHPortal is the single online home for the **SKH** automotive brand. One polished
**main portal** welcomes visitors and routes them into the brand's divisions. Each
division is a focused experience with its own content, branding accent, and (over
time) interactive features such as inventory browsing, bookings, enquiries, and
online accounts/payments.

The first impression must feel **premium** — this is a prestige automotive brand,
and the site should look the part from day one.

## 2. Divisions

| Division | Internal name | What it offers |
|----------|---------------|----------------|
| Vehicle Sales | **SKH Prestige** | Browsing/buying prestige & luxury vehicles |
| Servicing | SKH Servicing | Mechanical servicing, repairs, maintenance |
| Detailing | SKH Detailing | Valeting, paint correction, ceramic coating |
| Finance | **Fine Line** | Vehicle finance / leasing options |

> Phase 1 builds the **Main Portal** + **SKH Prestige** division page. The other
> divisions get placeholder/"coming soon" entry points in Phase 1 and are built out
> in later phases.

## 3. Technology

- **Framework:** Next.js (App Router, React, TypeScript)
- **Styling:** Ported brand design-system CSS (CSS variables + component classes)
  for pixel-perfect fidelity to the approved prototypes; Tailwind may layer in for
  net-new work in later phases
- **App database:** Standalone **PostgreSQL** (hosted on Railway), inspected via
  **pgAdmin**. Holds all application data (enquiries, vehicles, bookings, etc.).
- **Data access:** Prisma ORM (typed client + migrations); Prisma Studio for quick
  inspection, pgAdmin for full DB access
- **Authentication:** **Supabase Auth only** (manages users/JWTs). App data is NOT
  stored in Supabase — user IDs are referenced in the app Postgres by UUID.
- **File storage:** Supabase Storage (vehicle images, from Phase 2)
- **Forms / email:** Server actions → app Postgres + email notification
- **Hosting / deployment:** Railway (Next.js app **and** the Postgres database)
- **Images:** Next.js Image optimization + Supabase Storage for uploaded assets

### Why this stack
Next.js gives us fast, SEO-friendly marketing pages now and a clean path to
authenticated, data-driven features later. A standalone Postgres on Railway keeps all
application data in one place you fully own and can browse in pgAdmin, while Supabase
handles authentication only. Because Supabase Row-Level Security governs only
Supabase's own database, access control for the app Postgres is enforced in the
Next.js **server layer**: Supabase verifies the user and issues a session/JWT, the
server validates it, then queries Postgres. This separation is introduced from
Phase 4 (accounts); earlier phases need no auth.

## 4. Phased delivery

Each phase is independently shippable and gets its own detailed spec + implementation
plan before any code is written.

### Phase 1 — Foundation + Main Portal + SKH Prestige  *(current target)*
- Project scaffolding (Next.js + Tailwind + TypeScript + Supabase client)
- Design system foundations: colors, typography, spacing, core components
- **Main portal page**: hero, brand intro, division navigation cards, footer
- **SKH Prestige page**: premium landing for vehicle sales (static/curated content
  for now, no live inventory yet)
- Global enquiry/contact form → stored in Supabase + emailed to SKH
- Responsive (mobile-first), accessible, SEO basics (metadata, sitemap, OG tags)
- Placeholder entry points for Servicing, Detailing, Fine Line
- Deployment to a live URL

**Outcome:** A real, live, premium-looking site with the main portal and the flagship
Prestige division — ready to share.

### Phase 2 — Vehicle Inventory (SKH Prestige)
- Supabase schema for vehicles (make, model, year, price, mileage, specs, status)
- Image gallery per vehicle (Supabase Storage)
- Public inventory listing with search + filters (price, make, body type, etc.)
- Individual vehicle detail pages
- Per-vehicle enquiry / "reserve" form
- **Admin area** (auth-protected) to add/edit/remove vehicles

**Outcome:** Customers browse a real, filterable showroom; SKH manages stock.

### Phase 3 — Bookings (Servicing + Detailing)
- Build out Servicing and Detailing division pages
- Service catalog (service types, durations, prices)
- Date/time slot selection + availability rules
- Booking submission → stored + confirmation email
- Admin view of upcoming bookings

**Outcome:** Customers self-book service/detailing slots online.

### Phase 4 — Accounts + Online Payments
- Customer registration & login (Supabase Auth)
- Customer dashboard: their enquiries, bookings, vehicles of interest
- Online deposits / invoice payments (Stripe integration)
- Fine Line finance: application/enquiry flow
- Email receipts, security hardening, RLS review

**Outcome:** Full self-service customer experience with money movement.

## 5. Cross-cutting concerns (apply to every phase)
- **Design quality:** consistent premium aesthetic, no generic templates
- **Responsive & accessible:** mobile-first, keyboard + screen-reader friendly
- **Performance:** fast loads, optimized images, good Core Web Vitals
- **SEO:** semantic markup, metadata, sitemap, structured data where relevant
- **Security:** Supabase Row-Level Security, server-side validation, secrets in env
- **Maintainability:** typed, small focused components, documented decisions

## 6. Repository structure (target)

```
SKHPortal/
├─ docs/                     # roadmap + per-phase specs (this folder)
│  ├─ ROADMAP.md
│  └─ specs/
├─ src/
│  ├─ app/                   # Next.js App Router routes
│  │  ├─ page.tsx            # main portal
│  │  ├─ prestige/           # SKH Prestige division
│  │  ├─ servicing/          # (later)
│  │  ├─ detailing/          # (later)
│  │  └─ fine-line/          # (later)
│  ├─ components/            # reusable UI
│  ├─ lib/                   # db client, supabase-auth client, helpers
│  ├─ db/                    # Prisma client instance + query helpers
│  └─ styles/
├─ prisma/                   # schema.prisma + migrations (applied to app Postgres)
├─ public/                   # static assets
└─ .env                      # DATABASE_URL + secrets (gitignored)
```

## 7. Open questions to resolve before/within Phase 1
- Branding: logo, exact brand colors, fonts — do you have these, or should I
  propose a premium direction?
- Domain name for deployment?
- Contact destination email for enquiry-form submissions?
- Any real SKH copy/photography available, or use tasteful placeholders for now?

---

*Next step: review this roadmap. Once approved, we lock Phase 1 and I produce the
detailed Phase 1 implementation plan, then start building.*
