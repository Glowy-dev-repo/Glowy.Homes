# CLAUDE.md

You are the lead full stack engineer for this repository. Your job is to build the complete MVP described in `docs/` with zero hand holding. Read this file fully before touching anything.

## 1. Read order (do this first, every session)

1. `CLAUDE.md` (this file)
2. `docs/05_BUILD_PLAN.md` to find the current phase
3. `docs/01_PRODUCT_SPEC.md` for what to build
4. `docs/02_ARCHITECTURE_AND_DATA.md` for how to build it
5. `docs/03_PIPELINES.md` when working on ingestion, valuation, search, leads or alerts
6. `docs/04_DESIGN_SYSTEM.md` when building any UI
7. `docs/06_OPERATIONS_AND_RISKS.md` before any external data source or payment work
8. `PROGRESS.md` (you create this in Phase 0 and update it every session)

## 2. BRAND CONFIG (the human fills this in before Phase 0)

```yaml
brand_name: "Glowy Homes"           # replace with your brand
brand_short: "GH"                   # 2 to 3 letters for favicons and logos
domain: "glowy.homes"               # production domain
tagline: "Find your place."
primary_market_country: "CA"        # CA or US
primary_market_region: "Ontario"    # province or state to seed first
primary_market_cities: ["Toronto", "Mississauga", "Ottawa", "Hamilton", "London"]
currency: "CAD"
units: "metric"                     # metric or imperial
listing_feed: "synthetic"           # synthetic | reso_web_api | crea_ddf | csv
brand_color: "#A16207"              # one accent color only (warm glow gold, 4.9:1 on white)
neutral_scale: "stone"              # tailwind neutral family
font_sans: "Jost"
font_display: "Bodoni Moda"         # headings
support_email: "support@glowy.homes"
```

Rules for the config: never hardcode brand values in components. Everything reads from `src/config/brand.ts`, which is generated from this block in Phase 0.

## 3. Non negotiable rules

1. Never scrape Zillow, Realtor, Redfin, Homes.com, any MLS, or any listing site. Not for data, not for images, not for "reference". If a task seems to need it, stop and write the blocker in `PROGRESS.md`.
2. Never copy Zillow's logos, icons, illustrations, copy text, color palette or page layouts pixel for pixel. Build from `docs/04_DESIGN_SYSTEM.md`, which is original.
3. All listing data in development comes from the synthetic generator (`scripts/seed.ts`) unless `listing_feed` is set to a licensed source with credentials present in `.env`.
4. Never commit secrets. `.env` is gitignored. `.env.example` lists every key with a dummy value.
5. Every database change goes through a migration. No manual SQL against a shared database.
6. Every feature ships with: a working UI, an API route or server action, a database migration if needed, at least one unit test, and one Playwright test for the main happy path.
7. No feature is "done" until its acceptance criteria in `docs/05_BUILD_PLAN.md` pass and you have run the phase gate script.
8. Any estimate shown to a user (home value, rent estimate, affordability) must display a confidence range and a "this is an estimate, not an appraisal" disclaimer. This is a legal requirement, not a style choice.
9. Never guarantee timelines, approvals, financing, or outcomes anywhere in UI copy. Use "estimated", "typically", "subject to".
10. Do not use dashes (hyphens, en dashes, em dashes) in any user facing copy, headings, or documentation prose. Use commas, colons, or separate sentences. Hyphens inside code identifiers, package names, URLs and CSS are fine.

## 4. Tech stack (fixed, do not swap without writing a blocker)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | One codebase for web, API, SSR and SEO |
| Styling | Tailwind CSS v4 + shadcn/ui | Fast, consistent, accessible |
| Database | PostgreSQL 16 + PostGIS (Neon) | Geo search, full text, one database for everything |
| ORM | Drizzle ORM + drizzle kit migrations | Type safe, fast, plain SQL when needed |
| Auth | Auth.js v5 (email magic link + Google) | Standard, no vendor lock |
| Search | Postgres full text + PostGIS for MVP. Typesense in Phase 5 | Ship first, scale later |
| Maps | MapLibre GL JS + MapTiler tiles | Open, cheap, fast |
| Background jobs | Inngest | Cron, retries, fan out, works on Vercel |
| File storage | Cloudflare R2 via S3 SDK | Cheap image storage, no egress fees |
| Image processing | sharp | Resize, WebP, blur placeholders |
| Email | Resend + React Email | Alerts, magic links, lead notifications |
| Payments | Stripe (Phase 5 only) | Showcase listings, rental applications |
| Validation | Zod | Shared schemas between API and UI |
| Data fetching | TanStack Query on client, server components by default | Standard |
| Testing | Vitest (unit), Playwright (e2e) | Standard |
| Deploy | Vercel (app) + Neon (db) + Inngest Cloud | Zero ops |
| Monitoring | Sentry + Vercel Analytics | Errors and traffic |

## 5. Repo structure you must produce

```
/
  CLAUDE.md
  PROGRESS.md
  README.md
  .env.example
  package.json
  drizzle.config.ts
  next.config.ts
  tailwind.config.ts
  playwright.config.ts
  vitest.config.ts
  docs/
  scripts/
    seed.ts                 synthetic data generator
    phase_gate.ts           runs lint, typecheck, tests, build for the current phase
    reindex.ts              rebuilds search index
  src/
    app/                    Next.js routes (see docs/02 for full route map)
    components/
      ui/                   shadcn primitives
      listing/              ListingCard, PhotoGallery, FactsGrid, PriceHistory
      search/               SearchBar, FilterBar, MapView, ResultsList, DrawTool
      valuation/            EstimateCard, ConfidenceRange, CompsTable
      lead/                 ContactAgentForm, TourScheduler
      layout/               Header, Footer, Sidebar, MobileNav
    config/
      brand.ts              generated from CLAUDE.md BRAND CONFIG
      nav.ts
    db/
      schema/               one file per domain: users, listings, media, geo, valuation, leads, rentals, agents, billing, events
      migrations/
      index.ts
    lib/
      auth.ts
      search/               query builder, ranking, geo helpers
      valuation/            comps engine, estimate model
      ingestion/            adapters: synthetic, reso, crea_ddf, csv
      leads/                routing rules, scoring
      email/                templates
      media/                upload, resize, cdn urls
      analytics/            event tracking
    inngest/
      client.ts
      functions/            ingest_feed, refresh_valuations, send_saved_search_alerts, route_lead, process_media
    server/
      actions/              server actions grouped by domain
      api/                  route handlers grouped by domain
    types/
  tests/
    unit/
    e2e/
```

## 6. Build loop (repeat until all phases pass)

```
1. Open PROGRESS.md. Find the first phase whose status is not DONE.
2. Read that phase in docs/05_BUILD_PLAN.md. List every acceptance criterion.
3. For each criterion, in order:
   a. Write the migration (if any)  ->  npm run db:generate && npm run db:migrate
   b. Write the server logic (action or route) with Zod validation
   c. Write the UI from docs/04_DESIGN_SYSTEM.md
   d. Write one unit test and one e2e test
   e. Run: npm run lint && npm run typecheck && npm run test
4. Run: npm run phase:gate
5. If the gate fails, fix it. Do not move on. Do not skip tests to make it pass.
6. Update PROGRESS.md: phase status, what shipped, what was assumed, open blockers.
7. Commit with message: "phase(N): <short description>"
8. Go to step 1.
```

## 7. Assumption policy

When a spec is silent, choose the simplest option that keeps the door open for scale, write the choice in `PROGRESS.md` under "Assumptions", and keep going. Do not stop to ask. Stop only for the blockers listed in section 8.

## 8. Hard blockers (stop and write to PROGRESS.md under "BLOCKED")

1. A task requires scraping or copying a third party site.
2. A task requires a licensed data feed and credentials are missing.
3. A task requires payment processing and `STRIPE_SECRET_KEY` is missing.
4. A phase gate fails three times in a row on the same criterion.
5. A dependency has a known critical vulnerability with no patched version.

## 9. Definition of done for the MVP

The MVP is done when all of these are true on the deployed preview URL:

1. A visitor can search homes for sale and for rent by city, address, or map area, filter by price, beds, baths, home type, and see results on a synced map and list.
2. A visitor can open any listing and see photos, facts, price history, an estimate with a confidence range, similar homes, and neighborhood context.
3. A visitor can get an instant estimate for any address in the seeded market.
4. A signed in user can save homes, save searches, and receive email alerts when matches appear.
5. A signed in user can request a tour or contact an agent, and the lead lands in an agent's inbox with routing rules applied.
6. An agent can sign up, complete a profile, receive leads, and update lead status.
7. An owner can claim a home and see its value dashboard.
8. A landlord can post a rental listing and receive inquiries.
9. An admin can view feed health, listing counts, lead volume, and moderate content.
10. Lighthouse performance is 85 or higher on the search page and 90 or higher on the listing page, on mobile.
11. `npm run phase:gate` passes for every phase.

## 10. Commands to expose in package.json

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx scripts/seed.ts",
    "db:reset": "tsx scripts/reset.ts && npm run db:migrate && npm run db:seed",
    "search:reindex": "tsx scripts/reindex.ts",
    "phase:gate": "tsx scripts/phase_gate.ts",
    "inngest:dev": "npx inngest-cli@latest dev"
  }
}
```

## 11. Quality bar

1. Mobile first. Every page is designed at 390px width first, then expanded.
2. Server components by default. Client components only for interactivity (map, filters, forms, galleries).
3. All list pages paginate at 40 items. All map queries are bounded by the viewport plus a small buffer.
4. Every image goes through `next/image` with a blur placeholder.
5. Every form has loading, success, and error states.
6. Every page has a title, meta description, canonical URL, and Open Graph image. Listing pages emit `RealEstateListing` JSON LD.
7. No `any` types. No disabled lint rules without a comment explaining why.
8. p95 API response under 300ms for search, under 150ms for listing detail, measured locally against the seeded database of 50,000 listings.

## 12. When you finish

Write `HANDOFF.md` containing: deployed URL, admin login instructions, how to switch `listing_feed` from synthetic to licensed, the full list of assumptions, and the top ten things to build next in priority order.
