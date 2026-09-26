# 02 Architecture and Data

## 1. System overview

```
+----------------+     +--------------------+     +------------------+
| Listing feeds  | --> | Ingestion (Inngest)| --> |                  |
| synthetic/RESO |     | normalize, geocode |     |   PostgreSQL     |
| CREA DDF / CSV |     | dedupe, media      |     |   + PostGIS      |
+----------------+     +--------------------+     |                  |
                                                  |  listings        |
+----------------+     +--------------------+     |  properties      |
| Public sales   | --> | Valuation (Inngest)| --> |  valuations      |
| records (opt)  |     | comps + model      |     |  leads, users    |
+----------------+     +--------------------+     |  rentals, pros   |
                                                  +--------+---------+
                                                           |
                       +--------------------+              |
                       |  Next.js App       | <------------+
                       |  SSR pages, API    |
                       |  server actions    | --> Resend (email)
                       +--------------------+ --> R2 (images)
                                |             --> Stripe (Phase 5)
                                v
                       +--------------------+
                       | Browser / mobile   |
                       | MapLibre, forms    |
                       +--------------------+
```

One database. One app. One job runner. That is the whole MVP. Typesense, Redis and a separate ML service are Phase 5 or later and only when measurements say we need them.

## 2. Core concepts (get these right and everything else follows)

| Concept | Meaning |
|---|---|
| Property | A physical home. Exists forever. Has an address, a location, and physical facts. One row per real world home. |
| Listing | An event where a property is offered for sale or rent. A property can have many listings over time. Comes from a feed or a user. |
| Valuation | Our estimate of a property's value at a point in time. Recomputed on a schedule. |
| Lead | A consumer's intent to act (tour, contact, sell, preapproval, rental inquiry). Routed to exactly one pro. |
| Pro | An agent, lender or landlord account with service areas. |
| Saved search | A stored set of filters plus an alert frequency. |

The property versus listing split is what lets us show off market homes with values (the owner loop) and price history across multiple listings.

## 3. Database schema

PostgreSQL 16 with `postgis` and `pg_trgm` extensions. Written as SQL for clarity; implement in Drizzle with matching names. All tables have `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz default now()` unless noted.

```sql
-- =========================
-- USERS AND ROLES
-- =========================
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  phone text,
  image_url text,
  email_verified_at timestamptz,
  roles text[] not null default '{consumer}',   -- consumer, agent, lender, landlord, admin
  notification_prefs jsonb not null default '{"saved_search":"daily","marketing":false}',
  last_seen_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auth.js standard tables: accounts, sessions, verification_tokens (use the Drizzle adapter schema as is)

-- =========================
-- GEOGRAPHY
-- =========================
create table regions (
  id uuid primary key default gen_random_uuid(),
  type text not null,               -- country, province, city, neighborhood, postal_prefix
  name text not null,
  slug text not null,
  parent_id uuid references regions(id),
  boundary geography(multipolygon, 4326),
  centroid geography(point, 4326),
  stats jsonb not null default '{}',   -- cached: listing_count, median_price, median_rent, updated_at
  unique (type, slug, parent_id)
);
create index regions_boundary_gix on regions using gist (boundary);
create index regions_slug_idx on regions (slug);

-- =========================
-- PROPERTIES (physical homes)
-- =========================
create table properties (
  id uuid primary key default gen_random_uuid(),
  address_line1 text not null,
  address_line2 text,
  city text not null,
  region_code text not null,          -- ON, NY
  postal_code text not null,
  country text not null,              -- CA, US
  address_normalized text not null,   -- uppercase, no punctuation, used for dedupe
  location geography(point, 4326) not null,
  city_region_id uuid references regions(id),
  neighborhood_region_id uuid references regions(id),
  property_type text not null,        -- detached, semi, townhouse, condo, multi, land, other
  beds numeric(3,1),
  baths numeric(3,1),
  sqft integer,
  lot_sqft integer,
  year_built integer,
  stories integer,
  parking_spaces integer,
  facts jsonb not null default '{}',  -- heating, cooling, basement, exterior, roof, etc
  owner_user_id uuid references users(id),
  owner_claimed_at timestamptz,
  owner_facts_override jsonb,         -- owner edits, merged on top of facts for valuation
  last_sold_price integer,
  last_sold_at date,
  source text not null default 'feed',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (address_normalized, postal_code)
);
create index properties_location_gix on properties using gist (location);
create index properties_city_idx on properties (city_region_id);
create index properties_addr_trgm on properties using gin (address_normalized gin_trgm_ops);

-- =========================
-- LISTINGS
-- =========================
create table listings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  listing_type text not null,         -- sale, rent
  status text not null,               -- active, pending, sold, leased, expired, withdrawn, draft, in_review, rejected
  source text not null,               -- synthetic, reso, crea_ddf, csv, fsbo, landlord
  source_listing_id text,             -- MLS number or external id
  source_updated_at timestamptz,
  price integer not null,
  price_currency text not null default 'CAD',
  original_price integer,
  sold_price integer,
  list_date date not null,
  status_date date not null,
  sold_date date,
  available_date date,                -- rentals
  description text,
  features jsonb not null default '{}',   -- interior[], exterior[], building[], community[]
  rental_terms jsonb,                 -- pets, furnished, laundry, utilities_included, lease_min_months, deposit
  hoa_fee integer,
  tax_annual integer,
  virtual_tour_url text,
  listing_agent_id uuid references pros(id),
  brokerage_name text,                -- required attribution for MLS listings
  owner_user_id uuid references users(id),   -- fsbo or landlord
  is_featured boolean not null default false,
  featured_until timestamptz,
  view_count integer not null default 0,
  save_count integer not null default 0,
  search_vector tsvector,
  -- denormalized from property for fast search, refreshed by trigger
  location geography(point, 4326) not null,
  property_type text not null,
  beds numeric(3,1),
  baths numeric(3,1),
  sqft integer,
  city_region_id uuid,
  neighborhood_region_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (source, source_listing_id)
);
create index listings_search_main on listings (listing_type, status, price);
create index listings_location_gix on listings using gist (location);
create index listings_city_idx on listings (city_region_id, listing_type, status);
create index listings_fts on listings using gin (search_vector);
create index listings_list_date_idx on listings (list_date desc);

create table listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  kind text not null default 'photo',     -- photo, floorplan, video
  position integer not null default 0,
  source_url text,
  storage_key text,                        -- R2 key after processing
  width integer,
  height integer,
  blur_data_url text,
  caption text,
  processed_at timestamptz
);
create index listing_media_listing_idx on listing_media (listing_id, position);

create table listing_price_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  listing_id uuid references listings(id),
  event_type text not null,       -- listed, price_change, pending, sold, leased, relisted, withdrawn, expired
  price integer,
  event_date date not null,
  source text not null
);
create index lpe_property_idx on listing_price_events (property_id, event_date desc);

-- =========================
-- VALUATION
-- =========================
create table valuations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  kind text not null,                -- value, rent
  amount integer not null,
  low integer not null,
  high integer not null,
  confidence text not null,          -- low, medium, high
  model_version text not null,
  comps jsonb not null,              -- [{property_id, sold_price, sold_at, distance_m, adj_price, weight}]
  inputs jsonb not null,             -- snapshot of facts used
  computed_at timestamptz not null default now()
);
create index valuations_property_idx on valuations (property_id, kind, computed_at desc);

-- =========================
-- PROS (agents, lenders, landlords)
-- =========================
create table pros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) unique,
  pro_type text not null,            -- agent, lender, landlord, property_manager
  slug text unique not null,
  display_name text not null,
  brokerage_name text,
  license_number text,
  license_region text,
  license_verified_at timestamptz,
  phone text,
  bio text,
  photo_url text,
  languages text[] default '{en}',
  specialties text[] default '{}',
  years_experience integer,
  rating numeric(2,1),
  review_count integer not null default 0,
  response_time_minutes integer,     -- rolling 30 day median, updated by job
  lead_cap_per_day integer not null default 10,
  is_accepting_leads boolean not null default true,
  status text not null default 'pending',   -- pending, active, suspended
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table pro_service_areas (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references pros(id) on delete cascade,
  region_id uuid not null references regions(id),
  share_percent integer not null default 100,   -- Phase 5: purchased share of leads in that area
  active_until timestamptz,
  unique (pro_id, region_id)
);
create index psa_region_idx on pro_service_areas (region_id);

create table pro_reviews (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references pros(id),
  author_user_id uuid not null references users(id),
  lead_id uuid references leads(id),      -- verified if linked to a closed lead
  rating integer not null check (rating between 1 and 5),
  body text,
  status text not null default 'pending',
  created_at timestamptz default now()
);

-- =========================
-- LEADS
-- =========================
create table leads (
  id uuid primary key default gen_random_uuid(),
  lead_type text not null,           -- tour, contact, sell, preapproval, rental_inquiry, rental_application
  consumer_user_id uuid references users(id),
  consumer_name text not null,
  consumer_email text not null,
  consumer_phone text,
  listing_id uuid references listings(id),
  property_id uuid references properties(id),
  region_id uuid references regions(id),
  message text,
  payload jsonb not null default '{}',   -- tour windows, preapproval numbers, application answers
  assigned_pro_id uuid references pros(id),
  assigned_at timestamptz,
  routing_log jsonb not null default '[]',
  status text not null default 'new',   -- new, contacted, qualified, touring, under_contract, closed, lost, unassigned
  status_changed_at timestamptz default now(),
  first_response_at timestamptz,
  score integer not null default 0,     -- 0 to 100, see docs/03
  source_page text,
  utm jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index leads_pro_idx on leads (assigned_pro_id, status, created_at desc);
create index leads_consumer_idx on leads (consumer_user_id, created_at desc);

create table lead_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  sender_user_id uuid not null references users(id),
  body text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- =========================
-- CONSUMER SAVED STATE
-- =========================
create table saved_homes (
  user_id uuid not null references users(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  note text,
  created_at timestamptz default now(),
  primary key (user_id, listing_id)
);

create table saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  filters jsonb not null,             -- same shape as SearchParams zod schema
  boundary geography(polygon, 4326),
  alert_frequency text not null default 'daily',   -- instant, daily, weekly, off
  last_alert_at timestamptz,
  last_seen_listing_at timestamptz,
  created_at timestamptz default now()
);
create index saved_searches_alert_idx on saved_searches (alert_frequency, last_alert_at);

create table recently_viewed (
  user_id uuid not null references users(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  viewed_at timestamptz default now(),
  primary key (user_id, listing_id)
);

-- =========================
-- RENTALS
-- =========================
create table rental_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null references users(id),
  profile jsonb not null,             -- employment, income, references, pets, occupants (reused across listings)
  status text not null default 'draft',
  updated_at timestamptz default now()
);

create table rental_application_submissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references rental_applications(id),
  listing_id uuid not null references listings(id),
  lead_id uuid references leads(id),
  status text not null default 'submitted',   -- submitted, reviewing, approved, declined, withdrawn
  landlord_notes text,
  created_at timestamptz default now(),
  unique (application_id, listing_id)
);

-- =========================
-- INGESTION AND OPS
-- =========================
create table feed_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',   -- running, success, partial, failed
  stats jsonb not null default '{}',        -- fetched, created, updated, removed, media_queued, errors
  error_sample jsonb,
  cursor text                                -- feed side timestamp or token for incremental runs
);

create table moderation_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null,          -- listing, review, pro
  item_id uuid not null,
  reason text not null,             -- new_submission, flagged, edited
  status text not null default 'open',
  reviewer_user_id uuid references users(id),
  decision_note text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table events (
  id bigserial primary key,
  user_id uuid,
  anon_id text,
  name text not null,               -- listing_view, search, save_home, lead_submit, estimate_view, ...
  props jsonb not null default '{}',
  created_at timestamptz default now()
);
create index events_name_time_idx on events (name, created_at desc);
create index events_user_idx on events (user_id, created_at desc);

-- =========================
-- BILLING (Phase 5)
-- =========================
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references pros(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz default now()
);
```

### Triggers and maintenance

1. `listings.search_vector` is rebuilt on insert and update from address, city, neighborhood, description, features and source_listing_id.
2. Denormalized columns on `listings` (location, property_type, beds, baths, sqft, region ids) are copied from `properties` on insert and whenever the property changes.
3. `regions.stats` is refreshed nightly by the `refresh_region_stats` job.
4. `listings.save_count` is incremented and decremented by the save and unsave actions.

## 4. Shared Zod schemas (src/types)

```ts
export const SearchParams = z.object({
  type: z.enum(["sale", "rent"]).default("sale"),
  status: z.array(z.enum(["active", "pending", "sold", "leased"])).default(["active"]),
  q: z.string().max(200).optional(),          // free text
  city: z.string().optional(),                // region slug
  neighborhood: z.string().optional(),
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(), // west,south,east,north
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3).optional(),
  priceMin: z.number().int().nonnegative().optional(),
  priceMax: z.number().int().positive().optional(),
  bedsMin: z.number().min(0).max(10).optional(),
  bathsMin: z.number().min(0).max(10).optional(),
  propertyTypes: z.array(z.enum(["detached","semi","townhouse","condo","multi","land","other"])).optional(),
  sqftMin: z.number().int().optional(),
  sqftMax: z.number().int().optional(),
  yearBuiltMin: z.number().int().optional(),
  daysOnMarketMax: z.number().int().optional(),
  keywords: z.string().max(200).optional(),
  // rental only
  pets: z.boolean().optional(),
  furnished: z.boolean().optional(),
  availableBy: z.string().date().optional(),
  sort: z.enum(["newest","price_asc","price_desc","sqft_desc","ppsf_asc"]).default("newest"),
  page: z.number().int().min(1).default(1),
});
```

Every search page, saved search and alert uses this one schema. Never invent a second filter shape.

## 5. API contracts

All routes return `{ data, error, meta }`. Errors use `{ code, message, fields? }`. Auth via session cookie. Rate limit public routes at 60 requests per minute per IP using an in memory token bucket in MVP (Upstash in Phase 5).

| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/api/search` | Listings by SearchParams. Returns `{ items[], total, clusters?[] }`. Clusters returned when total > 200 and bounds present. | Public |
| GET | `/api/autocomplete?q=` | Grouped: regions, addresses, listing ids. Max 8 results. | Public |
| GET | `/api/listings/[id]` | Full LDP payload | Public |
| GET | `/api/listings/[id]/similar` | 6 similar listings | Public |
| GET | `/api/properties/lookup?address=` | Resolve address to property, create if not exists (geocode) | Public |
| GET | `/api/properties/[id]/valuation` | Latest value and rent valuation plus 12 month history | Public |
| POST | `/api/properties/[id]/claim` | Owner claim | Auth |
| PATCH | `/api/properties/[id]/facts` | Owner fact override, triggers revaluation | Auth, owner |
| POST | `/api/leads` | Create a lead (any type). Triggers routing job. | Public (captcha) |
| GET | `/api/pro/leads` | Lead inbox for current pro | Auth, pro |
| PATCH | `/api/pro/leads/[id]` | Update status, add note | Auth, pro |
| POST | `/api/leads/[id]/messages` | Send message | Auth, participant |
| POST | `/api/saved-homes` and DELETE | Save, unsave | Auth |
| POST | `/api/saved-searches` and PATCH and DELETE | Manage saved searches | Auth |
| POST | `/api/listings` | Create FSBO or rental listing (enters in_review) | Auth |
| POST | `/api/media/upload-url` | Presigned R2 upload URL | Auth |
| POST | `/api/rentals/applications` | Create or update reusable application | Auth |
| POST | `/api/rentals/applications/[id]/submit` | Submit to a listing | Auth |
| GET | `/api/admin/feed-health` | Feed run stats | Admin |
| GET | `/api/admin/moderation` and PATCH | Queue and decisions | Admin |
| POST | `/api/inngest` | Inngest handler | Signed |
| POST | `/api/events` | Analytics events, batched | Public |

## 6. Search query strategy (MVP, Postgres only)

```sql
select l.*, p.address_line1, m.storage_key as cover_key, m.blur_data_url
from listings l
join properties p on p.id = l.property_id
left join lateral (
  select storage_key, blur_data_url from listing_media
  where listing_id = l.id and kind = 'photo' order by position limit 1
) m on true
where l.listing_type = $type
  and l.status = any($status)
  and ($bounds is null or ST_Intersects(l.location, ST_MakeEnvelope($w,$s,$e,$n,4326)::geography))
  and ($polygon is null or ST_Within(l.location::geometry, $polygon))
  and ($city is null or l.city_region_id = $city)
  and ($priceMin is null or l.price >= $priceMin)
  and ($priceMax is null or l.price <= $priceMax)
  and ($bedsMin is null or l.beds >= $bedsMin)
  and ($q is null or l.search_vector @@ websearch_to_tsquery('english', $q))
order by
  l.is_featured desc,
  case $sort when 'newest' then l.list_date end desc,
  case $sort when 'price_asc' then l.price end asc,
  case $sort when 'price_desc' then l.price end desc
limit 40 offset $offset;
```

Clusters: when total > 200 and bounds are present, return `ST_ClusterKMeans` or a grid cluster (round lat and lng to a precision based on zoom level, group, count, average). Grid is simpler and fine for MVP.

Performance target: p95 under 300ms on 50,000 listings. If the seeded database misses this, add the missing index before adding any new technology.

## 7. Caching and rendering

| Page | Strategy |
|---|---|
| Home, mortgage, pro landing | Static |
| City and neighborhood browse | ISR, revalidate 24h, on demand revalidate after feed run |
| Listing detail | ISR, revalidate 1h, on demand revalidate when listing changes |
| Search | Dynamic, API responses cached 60s by exact query string |
| Account, pro, admin | Dynamic, no cache |

## 8. Security baseline

1. All inputs validated with Zod at the boundary.
2. Row level ownership checks in every action that touches user owned data.
3. Presigned uploads limited to image types and 10 MB.
4. Lead forms protected by Cloudflare Turnstile (skip in dev).
5. Admin routes behind role check in middleware plus per handler check.
6. Personal data (email, phone) never sent to the client for any user other than the viewer, except a pro seeing their own lead's contact info.
7. Headers: CSP, HSTS, no sniff, frame deny. Set in `next.config.ts`.
