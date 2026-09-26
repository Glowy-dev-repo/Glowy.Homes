# 05 Build Plan

Seven phases. Each phase ends with a gate. A phase is DONE only when every acceptance criterion passes and `npm run phase:gate` is green. `PROGRESS.md` tracks status as NOT STARTED, IN PROGRESS, BLOCKED, or DONE.

Estimated effort is for Claude Code running autonomously with a human checking gates. Real calendar time depends on review speed.

## Phase 0: Foundation

Goal: an empty but fully wired app that deploys.

Tasks:
1. Scaffold Next.js 15 with TypeScript strict, Tailwind v4, shadcn/ui, ESLint, Prettier.
2. Generate `src/config/brand.ts` from the BRAND CONFIG block in CLAUDE.md. Write a script `scripts/sync_brand.ts` that regenerates it.
3. Set up Drizzle with Neon, enable `postgis` and `pg_trgm`, write migration 0001 with every table in docs/02 section 3 except `subscriptions` and `valuation_accuracy`.
4. Auth.js v5 with email magic link (Resend) and Google. Roles array on users. Middleware protects `/account`, `/pro`, `/landlord`, `/admin`.
5. Inngest client and `/api/inngest` handler with one hello job.
6. R2 client and presigned upload helper.
7. Layout: Header, Footer, MobileNav from docs/04. Home page shell.
8. `scripts/phase_gate.ts`: runs lint, typecheck, unit tests, e2e tests, build, and prints a pass or fail summary. Accepts `--phase N` to also run phase specific checks listed below.
9. `PROGRESS.md` created with all seven phases listed.
10. Deploy to Vercel preview. Sentry wired.

Acceptance criteria:
1. `npm run dev` boots with no errors and home page renders header, hero search bar shell, footer.
2. Sign in with magic link works end to end in dev (use Resend test mode or log the link).
3. `npm run db:migrate` applies cleanly to an empty database.
4. Inngest dev server receives and runs the hello job.
5. Preview URL is live.

## Phase 1: Data and search

Goal: 50,000 synthetic listings, searchable on a map.

Tasks:
1. `scripts/seed.ts`: regions for configured cities with real boundaries (download from OpenStreetMap Nominatim or a bundled GeoJSON in `scripts/data/`), 10 to 20 neighborhoods per city with generated boundaries, 50,000 properties with realistic distributions of type, beds, baths, sqft, year built by city, 50,000 listings (70% sale, 30% rent; 60% active, 15% pending, 25% sold or leased in the last 24 months), price history events, 5 to 20 media per listing rendered by sharp, 200 synthetic pros with service areas, 20 test consumers, 1 admin. Deterministic with a seed. Runs in under 5 minutes.
2. Synthetic adapter implementing `ListingFeedAdapter` that reads a generated JSONL file, so ingestion is tested against the same code path as real feeds.
3. `ingest_feed`, `process_media`, `refresh_region_stats` per docs/03.
4. `/api/search`, `/api/autocomplete` with the Postgres strategy in docs/02 section 6, clusters included.
5. Search page: SearchBar, FilterBar, MapView, ResultsList, URL state, hover sync, mobile sheet.
6. City and neighborhood browse pages with ISR and internal linking.
7. Recently viewed (local storage).

Acceptance criteria:
1. Seed produces 50,000 listings; `select count(*)` matches.
2. `ingest_feed` on the synthetic JSONL is idempotent: running twice creates zero duplicates.
3. Search p95 under 300ms for 50 random filter combinations with bounds (script `tests/perf/search.ts`).
4. Dragging the map updates results and URL within 500ms (Playwright).
5. Every filter in SearchParams changes results and survives reload.
6. `/homes/toronto` renders server side with correct count, stats and 40 cards, and Lighthouse SEO score is 100.
7. Clusters appear when results exceed 200.

## Phase 2: Listing detail and accounts

Goal: the money page, plus saving.

Tasks:
1. LDP with every section in docs/01 section 4.2 in order, JSON LD, OG image route.
2. Photo gallery with full screen viewer and keyboard navigation.
3. Price history from listing_price_events.
4. Similar homes endpoint and section.
5. Monthly cost calculator (client component, inputs persist in local storage).
6. Saved homes (optimistic toggle, account page list).
7. Saved searches: save from search page, list on account page, edit frequency, delete.
8. Recently viewed synced to database for logged in users.
9. Account settings and notification preferences.

Acceptance criteria:
1. LDP Lighthouse mobile performance ≥ 90, accessibility ≥ 95.
2. LDP HTML (view source) contains price, address, beds, baths, sqft and description without JavaScript.
3. Save toggles work while logged out by prompting sign in and preserving intent after login.
4. Saved search round trip: save, reload, edit frequency, delete, all reflected in database.
5. Similar homes returns 6 results of the same type within 3 km and 20% of price for 95% of active listings (script).

## Phase 3: Valuation and owner loop

Goal: a value for every address, and owners claiming homes.

Tasks:
1. `comps_v1` model per docs/03 section 3 behind the `ValuationModel` interface, with unit tests using fixture comps.
2. `refresh_valuations` nightly plus on demand triggers. Market index in region stats.
3. `/api/properties/lookup` with geocoding and property creation for unknown addresses inside a seeded region.
4. `/home-value` lookup page and property value page with EstimateCard, chart, comps table and map.
5. EstimateCard on every LDP.
6. Claim flow (dev: instant; prod: verification step stub that sets `owner_claimed_at` only after a code is entered, code delivery to be wired to a mail vendor later, flagged in PROGRESS.md).
7. Owner fact overrides with revaluation.
8. `/account/homes` dashboard with value, 12 month change, "Thinking of selling" button creating a sell lead.
9. `valuation_accuracy` table and `score_valuations` job. Public `/methodology` page.

Acceptance criteria:
1. Every active sale listing in the seed has a valuation; insufficientData rate under 2%.
2. On synthetic data where true value is known, median absolute error under 8% (seed generates sold prices from a hidden formula plus noise so this is measurable).
3. No estimate renders without range, confidence and disclaimer (Playwright checks text on LDP and value page).
4. Owner edits sqft, estimate changes within 10 seconds.
5. Address not in database but inside a seeded city resolves to a new property with an estimate or a clear "not enough data" state.

## Phase 4: Leads and pros

Goal: intent becomes revenue.

Tasks:
1. Lead forms: tour, contact, sell, preapproval, rental inquiry. Turnstile in prod.
2. `/api/leads` and `route_lead` per docs/03 section 5, including scoring, caps, fallback and 30 minute reassignment.
3. Emails: pro new lead, consumer confirmation, admin unassigned alert.
4. Pro signup wizard, profile edit, public profile page, find an agent page.
5. Lead inbox and lead detail with status updates, notes, message thread, consumer activity.
6. Lender profiles and inbox (same components, pro_type filter).
7. Reviews (submit after lead status closed, pending moderation).
8. Admin: feed health, lead stats, manual reassignment, moderation queue for pros and reviews.

Acceptance criteria:
1. Tour request assigns to an agent within 60 seconds in dev (Inngest dev server) and appears in that agent's inbox as New.
2. Routing respects service area and daily cap in unit tests with 20 scenarios.
3. Unresponded lead reassigns after 30 minutes (test with a shortened timer in test env).
4. Agent with no service area never receives a lead.
5. Consumer sees pro name and photo in confirmation; pro sees consumer contact info; no other user can access either.
6. Admin can reassign a lead and the routing_log records it.

## Phase 5: Rentals and user listings

Goal: two sided rental marketplace and FSBO.

Tasks:
1. Rental wizard for landlords, FSBO wizard for owners, shared steps: address (must resolve to a property), facts, photos (presigned upload, min 3), price, description, contact preferences, review, submit.
2. Moderation auto checks and admin queue per docs/03 section 7.
3. Reusable rental application and submission to a listing.
4. Landlord dashboard: listings, inquiries, applications with status.
5. Rental specific filters wired end to end.
6. Featured listing flag and placement (payment stub, real Stripe only if key present).
7. Stripe (only if `STRIPE_SECRET_KEY` present): featured listing checkout, pro area subscription checkout, webhook to `subscriptions` and `listings.featured_until`.

Acceptance criteria:
1. Landlord submits listing, admin approves, listing appears in rental search within 5 minutes.
2. Submission with 2 photos is rejected client side and server side.
3. Renter applies once and submits to two listings without re entering data.
4. Landlord sees application and changes status; renter sees the new status.
5. If Stripe keys present: checkout completes in test mode and `featured_until` is set. If absent: feature flag hidden and PROGRESS.md notes it.

## Phase 6: Growth, AI and hardening

Goal: retention and scale.

Tasks:
1. `send_saved_search_alerts` all three frequencies with React Email templates.
2. Natural language search: LLM call turns text into SearchParams, shows parsed chips, user can edit. Provider behind an interface; default to Anthropic API if key present, else disabled.
3. Neighborhood summary generation (cached per region, regenerated weekly).
4. Shared saved homes list with a cobuyer (invite by email).
5. Analytics events end to end and admin funnel dashboard: search → LDP → lead by city.
6. Performance: image CDN headers, route level caching, index review, bundle analysis under 250 KB first load on search and LDP.
7. Security review: headers, rate limits, ownership checks, dependency audit.
8. Typesense adapter only if Phase 1 p95 is exceeded at 50,000 listings or seed is raised to 500,000 for a scale test.
9. `HANDOFF.md`.

Acceptance criteria:
1. Daily alert email sends exactly once per saved search with new matches (test clock).
2. Natural language query "3 bed condo under 900k in Mississauga with parking" produces the correct SearchParams in 9 of 10 fixture cases.
3. All Lighthouse targets from CLAUDE.md section 9 met on preview.
4. `npm audit` shows no critical or high vulnerabilities.
5. Every route in docs/01 section 5 exists and returns 200 or a correct redirect.
6. `HANDOFF.md` complete.

## Phase gate script requirements (`scripts/phase_gate.ts`)

```
1. npm run lint
2. npm run typecheck
3. npm run test
4. npm run build
5. Start app on a test port, run npm run test:e2e against it
6. Phase specific checks (switch on --phase):
   1: tests/perf/search.ts under 300ms p95; seed count check
   2: lighthouse on /listing/[sample] ≥ 90 perf, ≥ 95 a11y
   3: valuation coverage ≥ 98%, disclaimer presence check
   4: routing scenario tests
   5: moderation flow e2e
   6: all routes 200 check, bundle size check, audit
7. Print a table: check, status, duration. Exit 1 on any failure.
```

## PROGRESS.md template

```markdown
# Progress

| Phase | Status | Gate passed at | Notes |
|---|---|---|---|
| 0 Foundation | NOT STARTED | | |
| 1 Data and search | NOT STARTED | | |
| 2 LDP and accounts | NOT STARTED | | |
| 3 Valuation | NOT STARTED | | |
| 4 Leads and pros | NOT STARTED | | |
| 5 Rentals and user listings | NOT STARTED | | |
| 6 Growth and hardening | NOT STARTED | | |

## Assumptions
(append as you go, one line each, with the phase)

## BLOCKED
(append here; a blocker stops the phase, not the whole build, unless it blocks everything)

## Session log
(date, phase, what shipped, what is next)
```
