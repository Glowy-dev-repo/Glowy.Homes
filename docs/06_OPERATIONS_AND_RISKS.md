# 06 Operations and Risks

Read this before licensing data, taking payments, or going live. These are the things that kill real estate portals.

## 1. Red flags that stop the project until resolved

| Risk | Why it matters | What resolves it |
|---|---|---|
| Scraping Zillow, Realtor.ca, Redfin or any MLS for listings, photos or values | Illegal (terms breach, copyright, and in the US the CFAA has been used). Zillow and MLSs litigate. Photos are copyrighted by photographers and brokerages. | Licensed feed only. The MVP runs on synthetic data until a feed is signed. |
| Copying Zillow's design | Trade dress and copyright claims. Also brand confusion. | Original design system (docs/04). Same hierarchy, different look. |
| Using the word "Zestimate" or "Premier Agent" | Registered trademarks. | Use your own names. This doc uses "HomeValue" and "Pro" as placeholders. |
| Showing estimates without disclaimers | Consumer protection complaints, and in Canada some provinces regulate who can give a "valuation". | Every estimate carries range, confidence and the disclaimer. Call it an estimate, never an appraisal or valuation in UI copy. |
| Displaying MLS listings without attribution or past their allowed refresh window | Feed termination, fines from the board. | Brokerage attribution on every card and LDP. Refresh within the feed SLA. Remove within their window when status changes. |
| Handling rental applications with credit or background data | Privacy law (PIPEDA in Canada, FCRA in the US). | MVP collects applicant provided info only. Screening via a licensed vendor in a later phase with consent flow. |
| Fair housing | Ad targeting or search features that filter on protected classes are illegal. | No filters or copy involving family status, religion, ethnicity, disability. Fair housing statement in the footer. Moderation rejects listing text that violates this. |
| Lead selling without consent | Anti spam law (CASL in Canada, TCPA in the US for calls and texts). | Explicit consent checkbox on every lead form with plain language. Store consent timestamp and text version in the lead payload. |
| Real estate licensing | Some activities (negotiating, holding deposits) require a license. | The platform introduces and informs. It never negotiates, holds money for a transaction, or advises on price beyond the automated estimate. |

## 2. Data licensing paths

### Canada (primary market per config)
1. CREA DDF (Data Distribution Facility): national feed of REALTOR listings through RESO Web API. Requires a Technology Provider Agreement with CREA and a sponsoring brokerage or board. Typical timeline 4 to 12 weeks. Cost varies; budget for legal review.
2. Direct board feeds (for example TRREB in the Greater Toronto Area) for richer data. Separate agreements per board.
3. Sold data: in Ontario, sold prices became publicly displayable after the 2018 Competition Tribunal ruling, but only via the board's VOW (Virtual Office Website) rules, which require a logged in user who accepts terms. Build the VOW gate: sold prices and price history behind login with a terms acceptance timestamp. Add `vow_accepted_at` to users in Phase 3 if the market is Canada.

### United States
1. RESO Web API via an aggregator (Bridge Interactive, Trestle by CoreLogic, Spark by FBS, RealtyFeed) or direct MLS agreements. IDX rules per MLS. Some require a licensed broker of record.
2. Public records for off market properties and sold history from county assessors or vendors (ATTOM, CoreLogic, First American). Budget item.

### What to do now
Start the CREA DDF application in parallel with Phase 0. It is the long pole. Everything else can be built on synthetic data.

## 3. Monetization model (same as Zillow, sequenced for cash flow)

Ordered by how fast it produces cash with the least risk.

| Stream | Model | When | Failure point at volume |
|---|---|---|---|
| Agent area subscriptions | Monthly fee for a share of leads in a region. Price by region demand. | Phase 5 with Stripe | Lead quality complaints and churn if routing feels unfair. Publish routing rules. Cap leads per agent so nobody hoards. |
| Featured listings | Flat fee per listing for 30 days of top placement. | Phase 5 | Too many featured listings ruin the search. Cap at 10% of results per page. |
| Rental listing and application fees | Landlord pays per listing or per month; renter pays per application (where legal). | Phase 5 | Application fee rules differ by jurisdiction (Ontario restricts them). Check per region before enabling. |
| Lender leads | Per lead or per funded referral. | Phase 4 leads, billing Phase 5 | Mortgage referral fees are regulated. Legal review before charging. |
| Display advertising | Last resort. Hurts the calm design. | Not in MVP | |

Do not sell buyer leads to the listing agent by default. Zillow's model routes to a separate buyer's agent who pays. That is where the margin is.

## 4. Standard operating procedures

Every SOP has an owner role, a failure signal and a review cadence. Until hired, the founder holds every role.

### SOP 1: Daily operations check (10 minutes)
Owner role: Operations Lead
Steps:
1. Open `/admin`. Confirm last feed run succeeded within window.
2. Confirm unassigned leads = 0 in regions with active pros. Reassign manually if not.
3. Confirm moderation queue has nothing over 24 hours.
4. Check Sentry for new error groups. Assign or dismiss.
5. Check alert job last run times.
Failure signal: any of the five checks fail two days in a row.
Review cadence: the checklist itself is reviewed monthly.

### SOP 2: New pro onboarding
Owner role: Head of Pro Sales
Steps:
1. Pro submits signup with license number.
2. Verify license against the regulator registry (RECO in Ontario, state boards in the US). Record `license_verified_at`.
3. Approve, set `status = active`, confirm service areas and lead cap.
4. Send welcome email with response time expectations (30 minutes) and routing rules link.
5. First 5 leads: check response times personally.
Failure signal: pro active without `license_verified_at`, or a pro's median response time over 60 minutes in their first two weeks.
Review cadence: weekly pipeline of pending pros.

### SOP 3: Lead quality complaint
Owner role: Head of Pro Sales
Steps:
1. Open the lead, read routing_log and consumer activity.
2. If consumer info is fake or duplicate: mark lost with reason "invalid", credit the pro if on a paid plan.
3. If valid: explain the score and activity to the pro. No credit.
4. Log complaint reason in a monthly tally.
Failure signal: invalid lead rate over 5% in any region.
Review cadence: monthly.

### SOP 4: Feed outage
Owner role: Data Engineer
Steps:
1. Admin banner appears automatically when failure signal fires.
2. Check feed_runs.error_sample. If auth or quota: fix credentials, rerun.
3. If schema change from provider: update adapter normalize, add fixture, run adapter unit tests, rerun.
4. If outage over 4 hours: add a "listings last updated" notice on search pages.
5. Post incident: one paragraph in PROGRESS.md session log.
Failure signal: no successful run in 60 minutes.
Review cadence: weekly feed stats review.

### SOP 5: Estimate dispute
Owner role: Data Scientist
Steps:
1. Owner submits dispute from the value page (add a "Something wrong?" link that creates a support ticket in Phase 6).
2. Check comps used. If a comp is clearly wrong (data error), correct the source record and recompute.
3. If the owner disputes condition: direct them to claim the home and update facts.
4. Never manually set a value. Only inputs change.
Failure signal: more than 10 disputes per 1,000 estimate views per month in a city.
Review cadence: monthly with the accuracy report.

### SOP 6: Content takedown
Owner role: Operations Lead
Steps:
1. Request arrives (copyright, privacy, wrong listing).
2. Within 24 hours: set listing status withdrawn or remove media, log in moderation_items.
3. Reply to requester with confirmation.
4. If the item came from a feed, notify the feed provider.
Failure signal: any request older than 24 hours.
Review cadence: monthly.

## 5. Ownership map

| Area | Role | Hire trigger |
|---|---|---|
| Product and priorities | Founder | n/a |
| Build | Claude Code plus one reviewing engineer | Before Phase 4 goes live |
| Data feeds and valuation | Data Engineer | When a licensed feed is signed |
| Pro sales and lead ops | Head of Pro Sales | When 20 active pros |
| Moderation and support | Operations Lead | When 50 user listings per week |
| Legal and compliance | External counsel on retainer | Before licensing a feed and before Stripe goes live |

## 6. What breaks at volume (plan for it now, build it later)

| At | What breaks | Fix |
|---|---|---|
| 200k listings | Postgres full text and cluster queries slow on wide map views | Typesense for search, precomputed cluster tiles |
| 1M events per day | events table bloats | Move to a warehouse (ClickHouse or BigQuery), keep 30 days in Postgres |
| 500 pros | Round robin feels unfair, disputes rise | Share based routing with published percentages (already in schema) |
| 10 cities | Region stats and ISR revalidation take too long nightly | Partition jobs per city, stagger |
| Multiple provinces | Different VOW, disclosure and fee rules | Region rules config table, not code branches |
| Real photos | R2 storage and processing cost | Lazy process on first view for listings with zero views in 30 days |

## 7. Metrics that matter (admin dashboard, Phase 6)

1. Weekly active searchers
2. LDP views per searcher
3. Lead rate: leads per 1,000 LDP views (Zillow's benchmark range is roughly 5 to 15)
4. Lead to first response median minutes
5. Estimate coverage and median error by city
6. Saved search alert open and click rate
7. Pro retention month over month
8. Revenue per active pro
