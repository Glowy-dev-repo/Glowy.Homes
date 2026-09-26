# Progress

| Phase | Status | Gate passed at | Notes |
|---|---|---|---|
| 0 Foundation | BLOCKED | 2026-09-26 | Gate green. Criteria 1 to 4 pass. Criterion 5 (preview URL) waits on the deploy decision, see BLOCKED. |
| 1 Data and search | DONE | 2026-09-26 | All 7 criteria pass: 50,000 listings, idempotent ingest, search p95 75ms, map drag under 500ms, filters survive reload, city page SEO 100, clusters above 200. |
| 2 LDP and accounts | DONE | 2026-09-26 | All 5 criteria pass: LDP Lighthouse mobile perf 95 and a11y 100, facts in server HTML, save intent survives sign in, saved search round trip verified in the database, similar homes 95.8%. |
| 3 Valuation | NOT STARTED | | |
| 4 Leads and pros | NOT STARTED | | |
| 5 Rentals and user listings | NOT STARTED | | |
| 6 Growth and hardening | NOT STARTED | | |

## Assumptions

1. Phase 0: Local database is Postgres 16 with PostGIS 3.4 in Docker (`docker-compose.yml`, port 5433, `npm run db:up`). Production uses a hosted Postgres with PostGIS (Neon per the stack, Supabase also works) through `DATABASE_URL` only.
2. Phase 0: Brand config filled with Glowy.Homes, short GH, domain glowy.homes, support@glowy.homes. Market, currency, color and font kept from the blueprint.
3. Phase 0: Auth.js uses JWT sessions with roles in the token so middleware can authorize without a database call. The Drizzle adapter still stores users, accounts and verification tokens. Roles refresh when the session is updated.
4. Phase 0: Middleware runs on the Node runtime (stable in Next 15.5) because Auth.js needs APIs the Edge runtime lacks.
5. Phase 0: Access rules: `/pro` is the public pro landing page; `/pro/*` needs agent, lender or admin; `/account`, `/landlord` and `/sell/list` need any signed in user; `/admin` needs admin and is checked again in the page.
6. Phase 0: New env key `EMAIL_TRANSPORT` (resend or log). Log mode writes the latest email per recipient to `.dev-mail/` and the console, which is how magic links work in dev and in tests. It defaults to log when no Resend key is set.
7. Phase 0: Google sign in may link to an existing magic link account with the same email, because Google verifies email ownership.
8. Phase 0: The `users` table keeps the column names from docs/02 (`email_verified_at`, `image_url`) and maps them to the property names the Auth.js adapter expects.
9. Phase 0: Migrations are `0000_extensions` (postgis, pg_trgm) and `0001_core_schema` (23 tables, everything in docs/02 except `subscriptions` and `valuation_accuracy`). The search vector and denormalization triggers ship in Phase 1 with ingestion.
10. Phase 0: drizzle-kit quotes PostGIS column types, which Postgres rejects. `npm run db:generate` runs `scripts/fix_migrations.ts` afterwards to unquote them, and a unit test guards it.
11. Phase 0: The foreign key from `rental_application_submissions` to `rental_applications` has an explicit short name because the generated one exceeds the Postgres 63 character limit.
12. Phase 0: `NODE_ENV` was removed from `.env.example` because a development value there breaks `next build`. Next sets it itself.
13. Phase 0: The Inngest client runs in dev mode whenever no real signing key is configured, and in cloud mode (signed requests) when keys are present.
14. Phase 0: Sentry is inert without a DSN. When enabled it collects no user info, cookies or request bodies, so lead contact details never leave the app.
15. Phase 0: The CSP allows inline scripts for now because Next's hydration payload needs them. Nonce based CSP is part of the Phase 6 security review.
16. Phase 0: Inter is self hosted from `@fontsource-variable/inter` so builds never depend on a font CDN.
17. Phase 0: Tailwind v4 reads `tailwind.config.ts` through `@config`. `scripts/sync_brand.ts` generates `src/config/brand.ts` and `src/styles/brand.css`, which maps `neutral-*` utilities to the configured neutral family and defines the accent color.
18. Phase 0: The ui-ux-pro-max palette and font suggestions (teal, Cinzel) conflict with docs/04, so docs/04 wins. Its marketplace pattern (search bar as the main call to action) and UX checklist are adopted: Lucide icons, 44px targets, visible focus, 150 to 300ms transitions, reduced motion support.
19. Phase 0: shadcn/ui primitives are written by hand in shadcn style (`components.json` present) instead of running the interactive CLI.
20. Phase 0: The phase gate fails any phase that has no phase specific checks defined yet, so a gate can never pass by accident. It also refuses to run e2e when its port is already in use.
21. Phase 0: `npm run lint` keeps `next lint` as CLAUDE.md section 10 specifies. Next 15.5 prints a deprecation notice; move to the ESLint CLI when upgrading to Next 16.
22. Phase 0: Playwright runs every e2e test twice, on a 390px mobile viewport and a 1280px desktop viewport. Tests wait for a hydration marker before interacting.
23. Phase 1: Hosting is Render instead of Vercel and Neon, by owner decision: one Render web service running `next start` plus Render Postgres 16 with PostGIS (`render.yaml`). Inngest Cloud, R2, Resend and Sentry are unchanged. Migrations run in the Render build because home and city pages are prerendered from the database.
24. Phase 1: City boundaries are simplified polygons drawn for this project and bundled in code, so nothing is downloaded or scraped. Neighbourhoods are PostGIS Voronoi cells of generated seed points, clipped to the city, with invented generic names so they never imply real boundaries.
25. Phase 1: Synthetic photos are rendered by sharp on first request through the `/media` route and cached on disk, instead of rendering about 625,000 images during the seed. `process_media` handles real feeds: download, sharp, then R2 (or local disk when R2 is not configured).
26. Phase 1: `NormalizedListing` gained an optional `history` array (RESO feeds expose history resources). It is used only when a listing is first created; later changes are diffed.
27. Phase 1: The hidden pricing formula lives in `src/lib/ingestion/synthetic/model.ts`, and the seed writes true values to `scripts/data/generated/truth.jsonl` for the Phase 3 accuracy check.
28. Phase 1: The seed is deterministic for a given `SEED` and `SEED_AS_OF` date (default today in UTC). It refuses to run against a non local database unless `ALLOW_REMOTE_SEED=1`.
29. Phase 1: Search returns clusters whenever a search matches more than 200 listings (with or without bounds), using a grid sized from the viewport or the searched region. At 200 or fewer it returns light pins so the map shows every match while the list pages at 40. Under 60 results pins show price labels.
30. Phase 1: Without a MapTiler key the map uses a neutral base drawn from our own region outlines (`/api/regions/geo`). The MapLibre worker is served from `public/maplibre` (copied on install and before dev and build) because bundlers break its default path.
31. Phase 1: On mobile the search page opens on the list with a Map toggle (docs/04 allows this) so MapLibre stays out of the first load. The map is loaded lazily everywhere.
32. Phase 1: `units: metric`, so areas display in square metres. Storage and the `sqftMin`/`sqftMax` filters stay in sqft as the schema defines, converted at the UI.
33. Phase 1: Moving the map replaces the city, neighbourhood and text query with the visible bounds and uses `replaceState`, so panning does not flood browser history. Filter changes use `pushState` so Back undoes them.
34. Phase 1: The rate limit is configurable with `RATE_LIMIT_PER_MINUTE` (default 60 per docs/02). The phase gate raises it for its own test server.
35. Phase 1: City browse pages are prerendered at build and revalidated daily; neighbourhood and rental pages render on first request and are then cached. Rentals have no neighbourhood pages in the route map, so rental neighbourhood links open the map search.
36. Phase 1: Status badges show a coloured dot with dark text, because white text on the status green is below 4.5:1 contrast.
37. Phase 1: Recently viewed is recorded when a listing card is opened; the listing page records it too once it exists in Phase 2.
38. Phase 1: docs/04 does not place a search box on the search page; a SearchBar sits above the filter chips.
39. Phase 1: Feed listings link to a pro when the feed agent's licence number matches a pro's licence number.
40. Phase 1: The ui-ux-pro-max review items applied to search: 44px targets, visible focus, labelled controls, skeletons while loading, empty state with recovery actions, reduced motion respected.
41. Phase 2: Synthetic data was made more realistic so similar homes behave like a real market: each neighbourhood has its own home type mix, rental share, typical home size and construction era; rentals are mostly condos; multi unit homes are about 2% and vacant land 0.1% of listings. Similar homes coverage is 95.8% with seed 42 and 95.3% with seed 7. The criterion script itself was not changed.
42. Phase 2: When fewer than 6 homes meet the strict similar rule (same type, 3 km, 20% of price), the section is filled from a wider ring (15 km, 40% of price) and the API marks which results are strict.
43. Phase 2: Until the Phase 4 lead forms exist, "Request a tour" and "Contact agent" on the listing page scroll to the listing agent card, which shows the agent's phone number.
44. Phase 2: The estimate card shows the docs/04 "not enough recent sales" state until Phase 3 computes valuations. The monthly payment on the card is a range (rate plus or minus half a point) with a Medium confidence label and its own disclaimer.
45. Phase 2: There is no licensed school or walkability data, so the neighbourhood section shows local density (homes within 1 km) and says school information is not available yet. The commute input is a straight line estimate with a time range, a Low confidence label and a disclaimer, using our own autocomplete for destinations.
46. Phase 2: Tax history shows the annual tax the feed provides; there is no multi year tax data yet.
47. Phase 2: The mortgage calculator uses Canadian semi annual compounding, a default 4.79% rate, standard mortgage default insurance premiums below 20% down (none at $1.5M and above) and the Canadian minimum down payment rules. Down payment, rate, amortization and insurance persist in local storage; price, tax and fees come from each listing.
48. Phase 2: Intent survives sign in through the return URL: `?save=<listingId>` completes a save, and `?saveSearch=1` reopens the save search dialog.
49. Phase 2: Recently viewed stays in local storage and, for signed in users, is pushed to and pulled from the database so it follows the user across devices.
50. Phase 2: Saved searches store the SearchParams filters without the page number; a drawn polygon is also stored in the `boundary` column. Each user can keep up to 50.
51. Phase 2: Drizzle and raw SQL use separate connection pools, because Drizzle replaces its client's JSON serializers and that broke `sql.json()` in raw queries.
52. Phase 2: Server action forms echo submitted values back, because React 19 resets uncontrolled fields after an action.
53. Phase 2: "Tours and inquiries" and "My homes" in the account area are empty states until Phases 4 and 3 fill them.
54. Phase 2: Listing pages render on first request and are cached (ISR, hourly); each has its own Open Graph image. First load JavaScript is 257 KB on the listing page and 276 KB on search, to be brought under 250 KB in Phase 6.

## BLOCKED

1. Phase 0, criterion 5 (preview URL is live, Sentry wired to a real project).
   What I tried: everything else in Phase 0 runs locally and the gate is green; Sentry is wired and only needs a DSN. Hosting is now Render (your decision): `render.yaml` defines the web service and a Render Postgres 16 database, and `/api/health` is the health check. I have not pushed or deployed, because that sends the code off this PC and needs your go ahead.
   What I need from you, when you decide to go live:
   a. Say "push" so I run `git push`, then in Render choose New, Blueprint, and pick the Glowy.Homes repo.
   b. In the Render dashboard, fill the secrets marked `sync: false` (Resend key, and optionally Google OAuth, MapTiler, Inngest, R2, Sentry).
   c. Load demo data once from the Render shell: `ALLOW_REMOTE_SEED=1 npm run db:seed`.
   d. A Resend account with glowy.homes verified (add the records Resend gives you in Squarespace DNS; keep the existing Email Security records).
   e. Point glowy.homes at Render in Squarespace DNS, replacing the Squarespace Defaults preset with the records Render shows when you add the custom domain.

## Session log

- 2026-09-26, Phase 0: Scaffolded Next.js 15.5 (TypeScript strict, Tailwind v4, shadcn style primitives, ESLint, Prettier). Brand sync script and generated brand files. Drizzle schema for 23 tables with PostGIS and pg_trgm, migrations verified on an empty database. Auth.js with magic link (log transport in dev) and Google, roles, protected routes. Inngest client and hello job, verified against the Inngest dev server. R2 client and presigned upload route. Header, Footer, MobileNav and home page shell. Sentry wiring and security headers. Phase gate script. Gate result: PASS (lint, typecheck, 22 unit tests, build, 14 e2e tests, migrations on empty database). Next: Phase 1, data and search.
- 2026-09-26, Phase 1: Deterministic synthetic market (5 cities, 80 neighbourhoods, 50,000 properties and listings, 200 pros, 20 consumers, 1 admin) seeded in about 80 seconds through the real ingestion path. Ingestion with address normalization, owner override rules, price history diffing, media diffing and feed run stats; Inngest functions for ingest_feed, process_media and refresh_region_stats. Search API with clusters and pins, autocomplete, rate limiting and caching. Search page with SearchBar, FilterBar (chips and mobile sheet), MapLibre map with hover sync, results list with sort, pagination and empty state. City, neighbourhood and rental browse pages with stats, internal links, map preview and breadcrumb JSON LD. Recently viewed. Render blueprint and health check. Gate result: PASS (47 unit tests, 50 e2e tests, seed count, idempotent replay, search p95 75ms, SEO 100). Next: Phase 2, listing detail and accounts.
- 2026-09-26, Phase 2: Listing detail page with all 14 sections in the docs/01 order (gallery with full screen viewer, price block, actions, estimate card, key facts, description, facts and features, price history, tax history, monthly cost calculator, neighbourhood with commute estimate, similar homes, agent attribution, mobile sticky bar), RealEstateListing JSON LD and per listing Open Graph image. Saved homes with optimistic toggles and intent preserved through sign in; saved searches with create, edit frequency and delete; recently viewed synced to the account; account area with settings and notification preferences. Fixed a sideways scroll bug on the account page on phones and added a regression test for it. Gate result: PASS (57 unit tests, 68 e2e tests, LDP perf 95 and a11y 100, similar homes 95.8%). Next: Phase 3, valuation and the owner loop.
