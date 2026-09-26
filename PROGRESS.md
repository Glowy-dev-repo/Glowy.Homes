# Progress

| Phase | Status | Gate passed at | Notes |
|---|---|---|---|
| 0 Foundation | BLOCKED | 2026-09-26 | Gate green. Criteria 1 to 4 pass. Criterion 5 (preview URL) waits on the deploy decision, see BLOCKED. |
| 1 Data and search | NOT STARTED | | |
| 2 LDP and accounts | NOT STARTED | | |
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

## BLOCKED

1. Phase 0, criterion 5 (preview URL is live, Sentry wired to a real project).
   What I tried: everything else in Phase 0 runs locally and the gate is green; Sentry is wired and only needs a DSN. I did not deploy because CLAUDE.local.md says nothing leaves this PC, and deploying needs accounts only you can create.
   What I need from you, when you decide to go live:
   a. A Vercel project imported from the GitHub repo.
   b. A hosted Postgres with PostGIS (Neon or Supabase) and its `DATABASE_URL` set in Vercel.
   c. `AUTH_SECRET`, and optionally Google OAuth keys, set in Vercel.
   d. A Resend account with glowy.homes verified (add the records Resend gives you in Squarespace DNS; keep the existing Email Security records).
   e. Inngest Cloud keys and a Sentry DSN (optional until launch).
   f. Point glowy.homes at Vercel in Squarespace DNS, replacing the Squarespace Defaults preset.

## Session log

- 2026-09-26, Phase 0: Scaffolded Next.js 15.5 (TypeScript strict, Tailwind v4, shadcn style primitives, ESLint, Prettier). Brand sync script and generated brand files. Drizzle schema for 23 tables with PostGIS and pg_trgm, migrations verified on an empty database. Auth.js with magic link (log transport in dev) and Google, roles, protected routes. Inngest client and hello job, verified against the Inngest dev server. R2 client and presigned upload route. Header, Footer, MobileNav and home page shell. Sentry wiring and security headers. Phase gate script. Gate result: PASS (lint, typecheck, 22 unit tests, build, 14 e2e tests, migrations on empty database). Next: Phase 1, data and search.
