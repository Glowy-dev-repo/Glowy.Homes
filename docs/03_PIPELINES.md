# 03 Pipelines

These are the background systems that make the product feel alive. Each is an Inngest function. Each has an owner role, a failure signal and a review cadence, because a silent pipeline failure means stale listings, wrong values, or leads that never arrive.

## 1. Listing ingestion

### 1.1 Adapter interface

Every data source implements the same interface so the rest of the system never cares where listings come from.

```ts
export interface ListingFeedAdapter {
  source: "synthetic" | "reso" | "crea_ddf" | "csv";
  // Return listings changed since cursor. Pull in pages. Never load everything in memory.
  fetchChanged(cursor: string | null, pageSize: number): AsyncGenerator<{ items: RawListing[]; nextCursor: string | null }>;
  // Map a raw feed record to our normalized shape. Pure function. Unit tested per adapter.
  normalize(raw: RawListing): NormalizedListing;
}

export type NormalizedListing = {
  sourceListingId: string;
  sourceUpdatedAt: string;
  listingType: "sale" | "rent";
  status: "active" | "pending" | "sold" | "leased" | "expired" | "withdrawn";
  price: number;
  originalPrice?: number;
  soldPrice?: number;
  listDate: string;
  statusDate: string;
  soldDate?: string;
  availableDate?: string;
  address: { line1: string; line2?: string; city: string; regionCode: string; postalCode: string; country: string };
  location?: { lat: number; lng: number };   // geocode if missing
  propertyType: PropertyType;
  beds?: number; baths?: number; sqft?: number; lotSqft?: number; yearBuilt?: number;
  facts: Record<string, unknown>;
  features: { interior: string[]; exterior: string[]; building: string[]; community: string[] };
  rentalTerms?: RentalTerms;
  description?: string;
  hoaFee?: number; taxAnnual?: number;
  virtualTourUrl?: string;
  media: { url: string; kind: "photo" | "floorplan" | "video"; position: number; caption?: string }[];
  agent?: { name: string; email?: string; phone?: string; licenseNumber?: string; brokerage: string };
};
```

### 1.2 Sources

| Adapter | When | Notes |
|---|---|---|
| `synthetic` | Default. Dev, test, demo. | `scripts/seed.ts` generates 50,000 realistic listings across the configured cities using real street grids from OpenStreetMap extracts (downloaded once, cached) or a simple lat lng jitter around city centroids if offline. Generates price history, sold comps for 24 months, photos from a local placeholder set rendered with sharp (colored gradients with the address baked in, never third party images). |
| `reso` | US markets | RESO Web API (OData). Requires MLS approval and a vendor agreement (Bridge Interactive, Trestle, Spark, or direct MLS). Incremental via `ModificationTimestamp gt cursor`. Must honor MLS display rules: brokerage attribution, refresh within their SLA (often 15 minutes to 24 hours), remove listings when status changes. |
| `crea_ddf` | Canada | CREA DDF via RESO Web API. Requires a DDF Technology Provider agreement and a broker or board sponsor. Same incremental pattern. Must display "listing courtesy of" attribution and the REALTOR trademark rules. |
| `csv` | Pilot brokerages, bulk imports | Upload through admin. Validated against a template. Enters moderation. |

### 1.3 Ingest function: `ingest_feed`

Trigger: cron every 15 minutes for `reso` and `crea_ddf`, on demand for `synthetic` and `csv`.

```
1. Create feed_runs row (status running).
2. Load last successful cursor for this source.
3. For each page from adapter.fetchChanged(cursor):
   a. normalize each record (catch per record, log to error_sample, continue)
   b. upsert property:
      - normalize address (uppercase, strip punctuation, expand abbreviations)
      - find by (address_normalized, postal_code)
      - if not found: geocode if no location (MapTiler geocoding, cache by address), assign city and neighborhood region by ST_Within, insert
      - if found: update physical facts only if feed value is non null and property.owner_facts_override does not cover that field
   c. upsert listing by (source, source_listing_id):
      - if status changed or price changed: insert listing_price_events row
      - update denormalized columns
   d. diff media: queue process_media for new or changed urls, mark removed ones
   e. if listing status moved out of active: queue revalidate for LDP and its region pages
4. Save cursor = max sourceUpdatedAt seen.
5. Mark run success or partial (partial if errors > 0 and errors < 2% of fetched). Failed if adapter threw or errors ≥ 2%.
6. Emit event feed.completed with stats.
```

Idempotent. Safe to rerun. Never deletes properties. Listings are never hard deleted, only status changed, so price history is preserved.

Owner role: Data Engineer (or the founder until hired)
Failure signal: no successful run in 60 minutes for a scheduled source, or errors ≥ 2% of fetched, or active listing count drops more than 15% between runs. Alert to admin email and admin dashboard banner.
Review cadence: weekly review of feed_runs stats, monthly review of normalization error samples.

## 2. Media pipeline: `process_media`

Trigger: event `media.queued` (fan out, one job per media row, concurrency 20).

```
1. Download source_url (10s timeout, 15 MB max). For synthetic, render locally.
2. sharp: auto orient, strip metadata, produce WebP at 1600w, 800w, 400w. Produce a 16px blur placeholder as base64.
3. Upload variants to R2 under listings/{listingId}/{mediaId}/{width}.webp
4. Update listing_media: storage_key, width, height, blur_data_url, processed_at.
5. On failure: retry 3 times with backoff, then mark processed_at null and log. LDP shows a neutral placeholder for unprocessed media.
```

Owner role: Backend Engineer
Failure signal: more than 5% of media rows older than 1 hour with processed_at null.
Review cadence: monthly storage cost and failure rate review.

## 3. Valuation engine: `refresh_valuations`

This is our Zestimate equivalent. The MVP model is a transparent comparable sales model. It is explainable, it is defensible, and it is good enough to drive the owner loop. A machine learning model can replace `estimate()` later behind the same interface.

### 3.1 Interface

```ts
export interface ValuationModel {
  version: string;
  estimate(input: ValuationInput): Promise<ValuationResult | { insufficientData: true; reason: string }>;
}
```

### 3.2 MVP model: `comps_v1`

```
Inputs: property facts (merged with owner overrides), location, property_type.

1. Candidate comps: sold listings of the same property_type within 5 km, sold in the last 12 months, with sqft and beds present. Expand to 10 km and 18 months if fewer than 5 found. If fewer than 3 after expansion: return insufficientData.
2. For each comp compute an adjusted price:
   adj = sold_price
       * (subject_sqft / comp_sqft) ^ 0.6           (sqft matters, but not linearly)
       * (1 + 0.03 * (subject_beds - comp_beds))    (each bed about 3%)
       * (1 + 0.025 * (subject_baths - comp_baths))
       * (1 + 0.002 * (subject_year_built - comp_year_built))   (0.2% per year)
       * market_index(subject_city, today) / market_index(subject_city, comp.sold_date)   (time adjustment)
3. Weight each comp: w = 1 / (1 + distance_km) * 1 / (1 + months_since_sale / 6) * similarity where similarity penalizes sqft difference over 25% and bed difference over 1.
4. Estimate = weighted median of adj prices (median resists outliers better than mean).
5. Range: weighted 20th and 80th percentile of adj prices, but never narrower than plus or minus 4% of estimate.
6. Confidence: high if ≥ 8 comps within 3 km and range width < 12% of estimate; medium if ≥ 5 comps and width < 20%; else low.
7. Rent estimate: same method using leased listings, and if fewer than 3 rent comps, fall back to value * regional gross rent yield / 12 (yield is a config per region, default 0.045 annually).
8. Store valuation row with comps and inputs snapshot.
```

`market_index(city, month)`: median sold price per sqft per city per month, computed nightly from listing_price_events, stored in `regions.stats.ppsf_index`. Missing months are linearly interpolated.

### 3.3 Schedule

1. Nightly at 02:00 local: recompute valuations for all properties with an active listing, all claimed properties, and any property viewed in the last 7 days.
2. On demand: when an owner edits facts, when a property is first looked up, when a comp sale lands within 1 km.
3. Everything else: lazily on first view, then cached 30 days.

### 3.4 Accuracy tracking (this is how Zillow keeps the Zestimate honest)

Nightly job `score_valuations`: for every listing that sold in the last day, find the valuation that existed 30 days before the sale, compute absolute percent error, store in `valuation_accuracy` (add this table in Phase 3). Admin dashboard shows median error and share within 5% and 10% by city. Public methodology page publishes the same numbers. If median error in a city exceeds 12%, show only "low" confidence in that city until it recovers.

Owner role: Data Scientist (founder until hired)
Failure signal: nightly job did not complete, or median error in any city over 12%, or any valuation rendered without a range and disclaimer.
Review cadence: weekly accuracy review, quarterly model version review.

## 4. Search index

MVP: Postgres is the index. `search_vector` trigger keeps full text current. `scripts/reindex.ts` rebuilds vectors and region stats.

Phase 5 trigger to add Typesense: p95 search over 300ms at real load, or need for typo tolerance and faceted counts. Adapter pattern: `src/lib/search/provider.ts` exposes `search(params)` and `autocomplete(q)`; Postgres and Typesense implementations behind it.

`refresh_region_stats` nightly: per region, active listing count for sale and rent, median list price, median rent, median ppsf, 30 day sold count, median days on market. Powers browse pages and the home page.

Owner role: Backend Engineer
Failure signal: search p95 over 500ms for 10 minutes, or region stats older than 48 hours.
Review cadence: weekly performance check.

## 5. Lead routing: `route_lead`

Trigger: `lead.created`. Must assign within 60 seconds.

```
1. Score the lead (0 to 100):
   +30 tour request, +20 contact, +40 sell, +25 preapproval, +15 rental inquiry
   +10 if logged in, +10 if phone provided, +15 if consumer has 3 or more saved homes, +10 if viewed 5 or more listings in 7 days
   +10 if listing price in top 30% of the city (higher commission)
   cap at 100
2. Determine target pro_type: agent for tour, contact, sell. Lender for preapproval. Landlord: the listing's owner_user_id, skip routing.
3. If lead is on a listing with listing_agent_id and that agent is active and accepting: assign to listing agent (buyer side goes to listing agent only if config allows; default is to route to a buyer's agent instead, matching the Zillow Premier Agent model). Config flag: route_to_listing_agent (default false).
4. Candidate pros: active, accepting, pro_type matches, service area contains the listing or property region (neighborhood first, then city), today's assigned count < lead_cap_per_day.
5. Rank candidates: share_percent weighted random (Phase 5), then lowest leads today, then best response_time_minutes, then rating.
6. Assign. Write routing_log with candidates considered and reason.
7. Notify pro (email, and SMS in Phase 5). Notify consumer with pro name and photo.
8. If no candidate: status unassigned, notify admin, retry every 30 minutes for 24 hours.
9. If pro has not set first_response_at within 30 minutes (agents) or 4 hours (lenders): reassign to next candidate, note in routing_log, decrement pro response score.
```

Owner role: Head of Pro Sales (founder until hired)
Failure signal: any lead unassigned over 2 hours in a region with active pros, or median first response time over 60 minutes for a week.
Review cadence: daily unassigned check via admin dashboard, weekly routing fairness review per region.

## 6. Saved search alerts: `send_saved_search_alerts`

```
Instant: every 5 minutes, saved searches with alert_frequency instant: run SearchParams, filter list_date or status_date > last_seen_listing_at, send if any.
Daily: 08:00 local per user timezone (default region timezone).
Weekly: Monday 08:00.

Email: subject "{n} new homes in {name}", up to 10 cards (photo, price, beds, baths, address, link with utm), link to full search, one click unsubscribe from that search. Update last_alert_at and last_seen_listing_at.
Skip if 0 matches. Never send more than one email per saved search per frequency window.
```

Owner role: Growth Engineer
Failure signal: alert job not run in 2x its window, or bounce rate over 3%, or complaint rate over 0.1%.
Review cadence: weekly open and click rates, monthly frequency tuning.

## 7. Moderation: user submitted listings

FSBO and rental listings enter `in_review`. Auto checks: 3 or more photos, price within 0.3x to 3x of the estimate for the property (if an estimate exists), description without contact info or external links, address geocodes. Passing items go to the queue as low priority; failing items as high priority with the failed checks listed. Admin approves or rejects with a note. Rejection emails the submitter with the reason.

Owner role: Operations Lead
Failure signal: any item in queue over 24 hours.
Review cadence: daily queue check, weekly rejection reason review.

## 8. Analytics events

Client sends batched events to `/api/events` every 10 seconds or on page hide. Server writes to `events`. Events tracked in MVP: `page_view`, `search`, `listing_view`, `photo_gallery_open`, `save_home`, `save_search`, `estimate_view`, `claim_home`, `lead_submit`, `lead_status_change`, `signup`, `login`. These feed the lead scorer and the admin dashboard. Retain 13 months, then aggregate and delete raw rows.

## 9. Pipeline map

```
cron 15m ──> ingest_feed ──> media.queued ──> process_media
                 │
                 └──> listing.changed ──> revalidate pages
                                     └──> maybe refresh_valuation (comp within 1 km)

cron nightly ──> refresh_region_stats
             ──> refresh_valuations
             ──> score_valuations

lead.created ──> route_lead ──> notify pro, notify consumer
                     └──> (30 min timer) check_first_response ──> reassign

cron 5m / daily / weekly ──> send_saved_search_alerts
```
