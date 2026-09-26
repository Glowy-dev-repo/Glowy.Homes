# Glowy.Homes

A real estate marketplace for Ontario: search homes for sale and for rent on a map, see an estimate for any address, and connect with local agents, lenders and landlords. Build status lives in `PROGRESS.md`.

## Run it locally

Requirements: Node 20.18 or newer, Docker Desktop.

1. `npm install`
2. `cp .env.example .env`, then set `AUTH_SECRET` to a random value (`openssl rand -base64 32`).
3. `npm run db:up` starts Postgres with PostGIS in Docker on port 5433.
4. `npm run db:migrate`
5. `npm run dev` and open http://localhost:3000

Sign in links are written to `.dev-mail/` and printed in the terminal while `EMAIL_TRANSPORT=log`. For background jobs, run `npm run inngest:dev` alongside the app. `npm run phase:gate -- --phase N` runs every check for a phase.

## Blueprint

The rest of this file describes the blueprint the product is built from.

A complete, executable blueprint for building a real estate marketplace with the same workflows, pipelines and product logic as Zillow, under your own brand.

This package is written so that Claude Code (or any capable engineer) can open the repo, read `CLAUDE.md`, and build the entire MVP phase by phase without further instructions.

## What is in this package

| File | Purpose |
|---|---|
| `CLAUDE.md` | The operator file. Claude reads this first. Contains config, rules, build loop, and definition of done. |
| `docs/01_PRODUCT_SPEC.md` | Every user type, journey, screen, and feature. What the product does. |
| `docs/02_ARCHITECTURE_AND_DATA.md` | Tech stack, repo structure, full database schema, API contracts. |
| `docs/03_PIPELINES.md` | Listing ingestion, valuation engine, search index, lead routing, alerts, media. |
| `docs/04_DESIGN_SYSTEM.md` | Visual system, components, layouts, and page templates. |
| `docs/05_BUILD_PLAN.md` | Phased build order with acceptance criteria and test gates. |
| `docs/06_OPERATIONS_AND_RISKS.md` | Legal, data licensing, monetization, SOPs, owners, failure signals. |
| `.env.example` | Every environment variable the system needs. |

## How to use it

1. Copy this folder into a new empty repo.
2. Open `CLAUDE.md` and fill in the `BRAND CONFIG` block (brand name, domain, market, colors).
3. Run Claude Code from the repo root: `claude` then say `Read CLAUDE.md and execute Phase 0.`
4. Claude builds phase by phase. Each phase ends with a verification gate that must pass before the next phase starts.

## Important before you start

This is not a copy of Zillow. It is an original product with the same job to be done. Three things must be true before it can go live with real data:

1. You have a licensed listing feed (RESO Web API or IDX in the US, CREA DDF in Canada). Scraping Zillow or any MLS is illegal and will get you sued.
2. You have your own brand, logo, colors and page designs. The design system here is original and follows the same information hierarchy Zillow uses, not its visuals.
3. You have reviewed `docs/06_OPERATIONS_AND_RISKS.md` and accepted the compliance items.

The MVP ships with a synthetic data generator so the entire system can be built, tested and demoed before any feed is licensed.
