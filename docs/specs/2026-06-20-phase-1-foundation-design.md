# Phase 1 — Foundation, Main Portal & SKH Prestige

> Detailed design spec for the first build phase of SKHPortal.
> **Status:** Draft for review · **Date:** 2026-06-20

---

## Goal

Ship a live, premium-quality site containing:
1. The **Main Portal** (landing page + division navigation)
2. The **SKH Prestige** division page (vehicle sales landing — curated content, no
   live inventory yet)
3. A working **enquiry form** that saves to Supabase and emails SKH
4. Placeholder entry points for Servicing, Detailing, and Fine Line

No accounts, no payments, no live inventory database in this phase — those are
Phases 2–4. Phase 1 is about a strong, real foundation and a great first impression.

## Scope

### In scope
- Next.js + TypeScript + Tailwind project scaffold
- Standalone Postgres (Railway) wiring via Prisma + one `enquiries` model/migration
- Shared design system: color tokens, typography, spacing, buttons, cards, layout
- Main portal page
- SKH Prestige page
- Global header/nav + footer
- Enquiry form (server-side handled, stored + emailed)
- "Coming soon" pages for the three other divisions
- Responsive, accessible, SEO basics
- Deploy to a live URL

### Out of scope (deferred)
- Vehicle inventory database & admin (Phase 2)
- Bookings (Phase 3)
- Auth, customer dashboard, payments (Phase 4)
- Live finance application flow (Phase 4)

## Pages & routes

| Route | Page | Notes |
|-------|------|-------|
| `/` | Main Portal | Hero, brand story, division cards, enquiry CTA, footer |
| `/prestige` | SKH Prestige | Hero, value props, featured (static) vehicles, enquiry CTA |
| `/servicing` | Coming soon | Branded placeholder + enquiry CTA |
| `/detailing` | Coming soon | Branded placeholder + enquiry CTA |
| `/fine-line` | Coming soon | Branded placeholder + enquiry CTA |
| `/contact` *(optional)* | Contact/enquiry | Or render the form inline on each page |

## Main Portal — content blocks
1. **Header / nav** — SKH logo, links to each division, "Enquire" button
2. **Hero** — full-bleed premium image, brand tagline, primary CTA
3. **Brand intro** — short statement of who SKH is
4. **Division cards** — 4 cards (Prestige, Servicing, Detailing, Fine Line),
   each linking to its page; visually signals which are live vs coming soon
5. **Why SKH / trust** — a few highlights (experience, quality, etc.)
6. **Enquiry CTA** — leads into the enquiry form
7. **Footer** — contact info, divisions, social, legal

## SKH Prestige — content blocks
1. **Hero** — prestige vehicle imagery, division tagline
2. **Intro** — what SKH Prestige does
3. **Featured vehicles** — a grid of curated example cars (static data for now;
   structured so it can later be swapped for the live Phase 2 inventory feed)
4. **Process / buying experience** — how purchasing works
5. **Enquiry CTA** — "Enquire about a vehicle" form

## Enquiry form

A single reusable form component used across pages.

**Fields:** name, email, phone (optional), division/subject (preselected by page),
message. Plus honeypot field for spam protection.

**Flow:**
1. User submits → Next.js **server action**
2. Server validates input (required fields, email format)
3. Insert row into the app Postgres `enquiries` table (via Prisma)
4. Send notification email to SKH's contact address
5. Return success/error state to the UI (with friendly messages)

**`enquiries` table (app Postgres, defined as a Prisma model + migration):**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk, default) | |
| `created_at` | timestamptz (default now) | |
| `name` | text | required |
| `email` | text | required |
| `phone` | text | nullable |
| `division` | text | e.g. `prestige`, `servicing`, `general` |
| `message` | text | required |
| `status` | text | default `new` (for future triage) |

Access: the app Postgres is reached **only** from the Next.js server (server
actions). The DB connection string is server-side env only and never exposed to the
browser, so there is no public read/write path. (Supabase RLS does not apply here —
this is a standalone Postgres, not Supabase's database.) You can browse the table
directly in pgAdmin.

## Design direction

**Aesthetic:** premium, confident, automotive. Default proposal (adjustable):
- **Palette:** deep near-black / charcoal base, off-white text, a single refined
  accent (e.g. warm gold or deep metallic blue) used sparingly.
- **Type:** an elegant display/serif or strong geometric sans for headings, clean
  readable sans for body. Generous spacing, large hero type.
- **Imagery:** large, high-quality vehicle photography; subtle motion/hover only.
- **Feel:** spacious, restrained, expensive — not busy or templated.

Component primitives to build: `Button`, `Card`, `Section`, `Container`,
`Header`, `Footer`, `EnquiryForm`, `DivisionCard`.

## Technical notes
- App Router with server components by default; client components only where needed
  (form interactivity).
- App Postgres accessed via a Prisma client singleton in `src/db`; `DATABASE_URL`
  is a **server-only** secret in `.env` (never committed, never `NEXT_PUBLIC_`).
- Supabase Auth client added now for config/wiring, but no login flow until Phase 4.
- pgAdmin connects to the same Postgres using its Railway connection string.
- Tailwind config holds the design tokens (colors, fonts, spacing).
- Accessibility: semantic landmarks, labelled inputs, focus states, color contrast.
- SEO: per-page metadata, Open Graph tags, `sitemap.xml`, `robots.txt`.
- Deployment: **Railway** runs the Next.js app **and** the Postgres database; env
  vars (Postgres connection string, Supabase auth keys, email provider key)
  configured in the Railway service.

## Success criteria
- [ ] Main portal and Prestige pages render, look premium, and are fully responsive
- [ ] All division nav links work (live pages + coming-soon placeholders)
- [ ] Enquiry form validates, stores a row in the app Postgres, and triggers an email
- [ ] The `enquiries` table is visible/queryable in pgAdmin
- [ ] No secrets committed; env documented in `.env.example`
- [ ] Lighthouse: solid scores for performance, accessibility, SEO
- [ ] Deployed and reachable at a live URL

## Assumptions / to confirm during Phase 1
- Brand assets (logo, colors, fonts): use proposed premium direction unless you
  provide specifics.
- Enquiry notification email address: **TBD — needs your input**.
- Vehicle photos for Prestige: tasteful placeholders unless you supply real images.
- Email sending mechanism: confirm provider (e.g. Resend) for the notification step.

---

*Review this spec alongside `docs/ROADMAP.md`. Once approved, I'll turn this into a
step-by-step implementation plan and begin building Phase 1.*
