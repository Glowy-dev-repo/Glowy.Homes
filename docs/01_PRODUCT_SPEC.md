# 01 Product Spec

## 1. What we are building, in plain terms

A website and mobile web app where anyone can:

1. Search every home for sale or rent in a market on a map
2. See what any home is worth, instantly
3. Save homes and searches and get told when something new appears
4. Talk to an agent, book a tour, or apply for a rental
5. If they own a home, track its value and sell it
6. If they are an agent, lender or landlord, get customers from the platform

That is the whole Zillow model: free for consumers, paid by professionals. Consumers bring traffic. Traffic becomes leads. Leads are sold to agents, lenders and landlords.

## 2. User types

| User | What they want | How we make money from them |
|---|---|---|
| Browser (logged out) | Look at homes, check values | Nothing directly. They become traffic and SEO. |
| Buyer | Find a home, know what they can afford, talk to an agent | Their lead is sold to an agent or lender |
| Renter | Find a rental, apply, pay rent | Application fees, landlord listing fees |
| Owner | Know their home value, decide when to sell | Their sell intent becomes a seller lead |
| Seller | List the home, get exposure | Premium listing upgrade (Showcase equivalent) |
| Agent | Get buyer and seller leads in their area | Monthly subscription by area or per lead |
| Lender | Get borrower leads | Per lead or per funded loan referral |
| Landlord / Property manager | Fill vacancies, screen tenants | Listing fee, application fee, payment processing |
| Admin (internal) | Keep data clean, keep pros happy, watch revenue | n/a |

## 3. The core loops

### Loop A: Search to lead (buyers)
Search → view listing → save home → request tour or contact → lead routed to agent → agent responds in app → tour happens → transaction tracked.

### Loop B: Value to seller lead (owners)
Type address → see estimate → claim home → see value dashboard monthly → "thinking of selling" → seller lead routed to agent, or owner lists directly.

### Loop C: Rental fill (landlords)
Landlord posts listing → renter searches → renter applies → landlord screens → lease signed → rent paid through platform.

### Loop D: Pro acquisition (agents)
Agent sees leads they are missing → signs up → buys area coverage → gets leads → renews.

Everything in this spec exists to make one of these four loops faster.

## 4. Feature list by priority

P0 = MVP must have. P1 = MVP should have. P2 = post MVP.

### 4.1 Search and discovery

| ID | Feature | Priority | Notes |
|---|---|---|---|
| S1 | Text search: city, neighborhood, postal code, address, listing ID | P0 | Autocomplete with grouped results |
| S2 | Map search with synced list | P0 | Pan and zoom updates results. Clusters above 200 results. |
| S3 | Filters: price, beds, baths, home type, sqft, lot size, year built, days on market, keywords, status (for sale, sold, pending, for rent) | P0 | Filters live in the URL so every search is shareable and indexable |
| S4 | Draw a custom boundary on the map | P1 | Polygon saved with the search |
| S5 | Sort: newest, price low to high, price high to low, sqft, price per sqft | P0 | |
| S6 | Saved searches with email alerts (instant, daily, weekly) | P0 | The number one retention driver |
| S7 | Recently viewed homes | P0 | Local storage for logged out, database for logged in |
| S8 | Natural language search ("3 bed under 900k near a park in Oakville") | P1 | LLM parses into structured filters, shows the parsed filters so user can correct |
| S9 | Browse pages by city, neighborhood, home type, price band | P0 | These are the SEO engine. Statically generated, revalidated daily. |
| S10 | Map layers: schools, transit, flood risk | P2 | |

### 4.2 Listing detail page (LDP)

This is the most important page in the product. Order of sections, top to bottom:

1. Photo gallery (hero + grid, full screen viewer, virtual tour link if present)
2. Price, address, beds, baths, sqft, status badge, days on market
3. Primary actions: Request a tour, Contact agent, Save, Share
4. Estimate card: our estimate with range, rent estimate, monthly payment estimate
5. Key facts: type, year built, lot, parking, heating, cooling, HOA or condo fee, MLS ID
6. Description (from feed or seller)
7. Full facts and features (grouped: interior, exterior, building, utilities, community)
8. Price history table (list, price change, sold, relisted)
9. Tax history (if available in feed)
10. Monthly cost calculator (principal and interest, tax, insurance, HOA, editable)
11. Neighborhood: walk score equivalent, nearby schools, commute time input
12. Similar homes (same type, plus or minus 20% price, within 3 km)
13. Listing agent card and brokerage attribution (required by MLS rules)
14. Sticky bottom bar on mobile with price and the two primary actions

Rules: the LDP must render server side with all facts in HTML for SEO. Gallery and calculator hydrate on the client. Every LDP emits `RealEstateListing` JSON LD.

### 4.3 Home valuation ("HomeValue", our Zestimate equivalent)

| ID | Feature | Priority |
|---|---|---|
| V1 | Instant estimate for any address in the seeded market, with low and high range and a confidence label | P0 |
| V2 | Rent estimate | P1 |
| V3 | Value history chart (12 months, monthly points) | P0 |
| V4 | Comparable sales used, shown with distance, sold date and price | P0 |
| V5 | Owner can claim home (verify by mailed code in prod, instant in dev) and edit facts to refine estimate | P0 |
| V6 | Owner dashboard: current value, monthly change, equity if mortgage entered, "what would I net if I sold" | P1 |
| V7 | "I am thinking of selling" button creates a seller lead | P0 |

Disclaimer text (must appear near every estimate): "This is an automated estimate, not an appraisal. Actual value depends on condition, market and a professional assessment."

### 4.4 Buyer tools

| ID | Feature | Priority |
|---|---|---|
| B1 | Affordability calculator (income, debts, down payment, rate → max price) | P0 |
| B2 | Mortgage calculator on every LDP | P0 |
| B3 | Rate table from partner lenders (static config in MVP) | P1 |
| B4 | Preapproval request form routed to lender lead | P1 |
| B5 | Saved homes with notes and shared list with a cobuyer | P1 |
| B6 | Tour request: pick 3 time windows, in person or video | P0 |
| B7 | Buyer hub: saved homes, searches, tours, agent, lender, next steps checklist | P2 |
| B8 | Offer insights: how a proposed price compares to list, estimate and recent sales | P2 |

### 4.5 Seller tools

| ID | Feature | Priority |
|---|---|---|
| SE1 | Sell flow: claim home → choose "agent" or "list myself" | P0 |
| SE2 | For sale by owner listing wizard (facts, photos, price, contact preferences) | P1 |
| SE3 | Premium listing upgrade: featured placement, larger card, top of similar homes | P2 (needs Stripe) |
| SE4 | Seller lead routed to agents who cover the area | P0 |

### 4.6 Rentals

| ID | Feature | Priority |
|---|---|---|
| R1 | Rental search with rental specific filters (pets, furnished, laundry, parking, available date) | P0 |
| R2 | Landlord posts a listing (wizard) | P0 |
| R3 | Renter inquiry form routed to landlord | P0 |
| R4 | Rental application (one application, reusable across listings) | P1 |
| R5 | Landlord dashboard: listings, inquiries, applications | P1 |
| R6 | Application fee and rent payments via Stripe | P2 |
| R7 | Lease e signature | P2 |

### 4.7 Professional side ("Pro", our Premier Agent equivalent)

| ID | Feature | Priority |
|---|---|---|
| P1 | Agent signup with license number, brokerage, service areas, photo, bio | P0 |
| P2 | Public agent profile page with active and sold listings and reviews | P0 |
| P3 | Lead inbox: new, contacted, qualified, touring, under contract, closed, lost | P0 |
| P4 | Lead routing: by area coverage, then round robin, then response time score | P0 |
| P5 | Lead detail: consumer activity (homes viewed, saved, searches) shown to the agent | P1 |
| P6 | In app messaging between consumer and agent | P1 |
| P7 | Area coverage purchase and subscription billing | P2 (needs Stripe) |
| P8 | Reviews from verified past clients | P1 |
| P9 | Lender profiles and lender lead inbox (same model as agents) | P1 |

### 4.8 Accounts

| ID | Feature | Priority |
|---|---|---|
| A1 | Email magic link and Google sign in | P0 |
| A2 | Roles: consumer, agent, lender, landlord, admin. One user can hold several. | P0 |
| A3 | Notification preferences | P0 |
| A4 | Delete account and export data | P1 |

### 4.9 Admin

| ID | Feature | Priority |
|---|---|---|
| AD1 | Feed health: last run, listings ingested, updated, removed, errors | P0 |
| AD2 | Listing moderation queue for user submitted listings | P0 |
| AD3 | Lead volume and routing stats by area | P0 |
| AD4 | Manual lead reassignment | P0 |
| AD5 | Content flags and takedown | P1 |
| AD6 | Revenue dashboard (Phase 5) | P2 |

### 4.10 AI assistant

| ID | Feature | Priority |
|---|---|---|
| AI1 | "Ask" box on search results: turns plain language into filters | P1 |
| AI2 | Listing Q and A: answer questions using only the listing's own facts | P2 |
| AI3 | Neighborhood summary generated from structured data, cached per neighborhood | P2 |

## 5. Route map

| Route | Page | Render |
|---|---|---|
| `/` | Home: search bar, three entry points (Buy, Rent, Sell), value lookup, featured cities | Static |
| `/homes/[city-slug]` | Browse for sale in city | ISR daily |
| `/homes/[city-slug]/[neighborhood-slug]` | Browse neighborhood | ISR daily |
| `/rentals/[city-slug]` | Browse rentals | ISR daily |
| `/search?...` | Map search with filters in query string | Dynamic |
| `/listing/[id]/[address-slug]` | Listing detail page | ISR, revalidate on listing update |
| `/home-value` | Address lookup | Static |
| `/home-value/[property-id]/[address-slug]` | Property value page (off market homes) | ISR |
| `/sell` | Sell landing, claim flow | Dynamic |
| `/sell/list` | FSBO wizard | Dynamic, auth |
| `/mortgage` | Calculators and rates | Static |
| `/mortgage/preapproval` | Preapproval form | Dynamic |
| `/agents/[city-slug]` | Find an agent | ISR |
| `/agent/[slug]` | Agent profile | ISR |
| `/account` | Saved homes, searches, tours, settings | Dynamic, auth |
| `/account/homes` | Claimed homes dashboard | Dynamic, auth |
| `/pro` | Pro landing | Static |
| `/pro/leads` | Lead inbox | Dynamic, auth, role agent or lender |
| `/pro/listings` | Agent listings | Dynamic, auth |
| `/pro/profile` | Edit profile | Dynamic, auth |
| `/landlord` | Landlord dashboard | Dynamic, auth |
| `/landlord/listings/new` | Rental wizard | Dynamic, auth |
| `/admin/*` | Admin | Dynamic, auth, role admin |
| `/api/*` | Route handlers (see docs/02) | |

## 6. Key user stories with acceptance criteria

### US1: Map search
Given I am on `/search?city=toronto`, when I drag the map, then within 500ms the list updates to show only homes inside the new viewport, the URL updates with the new bounds, and the result count updates. Clusters appear when more than 200 pins would show.

### US2: Saved search alert
Given I saved a search with daily alerts, when a new listing matches it, then within 24 hours I receive one email listing all new matches (max 10 with a link to see all), and the email links open the exact search.

### US3: Estimate
Given I type a valid address in the seeded market, when I submit, then I see a value, a low to high range, a confidence label (Low, Medium, High), the five comps used, and the disclaimer. If the address has fewer than 3 comps within 5 km in 12 months, I see "Not enough data" instead of a number.

### US4: Tour request to agent inbox
Given I request a tour on a listing, when I submit, then a lead is created, the routing job assigns it to one agent within 60 seconds, that agent gets an email and sees it in `/pro/leads` as "New", and I receive a confirmation email with the agent's name.

### US5: Claim home
Given I search my address on `/home-value`, when I click "This is my home", then in dev I am asked to confirm and the home is linked to my account; in prod a verification step is shown. After claiming I can edit beds, baths, sqft, condition, and the estimate recalculates.

### US6: Landlord listing
Given I am signed in, when I complete the rental wizard with at least 3 photos, price, beds, baths, address and available date, then the listing enters the moderation queue, an admin approves it, and it appears in rental search within 5 minutes.

## 7. Out of scope for MVP (so nobody drifts)

1. Native iOS and Android apps (mobile web only)
2. In house mortgage origination
3. Buying homes ourselves (Zillow tried this and shut it down)
4. 3D tours and virtual staging generation (link out only)
5. Title, escrow, closing services
6. Multiple countries at once (one country per deployment)
