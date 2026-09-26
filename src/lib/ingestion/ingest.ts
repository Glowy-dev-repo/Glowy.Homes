import type postgres from "postgres";
import { brand } from "@/config/brand";
import { normalizeAddress, normalizePostalCode } from "./address";
import { planListingEvents, type ExistingListing, type PlannedEvent } from "./events";
import type { ListingFeedAdapter, NormalizedListing } from "./types";

// ingest_feed core (docs/03 section 1.3). Idempotent: records whose sourceUpdatedAt is not newer
// than what is stored are skipped, and every write is an upsert on a natural key.

type Sql = postgres.Sql;

export type InlineMedia = (
  url: string,
) => { storageKey: string; blurDataUrl: string; width: number; height: number } | null;
export type Geocoder = (address: NormalizedListing["address"]) => Promise<{ lat: number; lng: number } | null>;

export type IngestStats = {
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  removed: number;
  media_queued: number;
  errors: number;
};

export type IngestResult = {
  runId: string;
  status: "success" | "partial" | "failed";
  stats: IngestStats;
  cursor: string | null;
  /** Listings whose status left active; their pages need revalidation. */
  deactivatedListingIds: string[];
  /** Media rows that need process_media. */
  queuedMediaIds: string[];
  /** Properties with a new closed sale, for valuation refresh of nearby homes. */
  soldPropertyIds: string[];
};

/** jsonb parameter; postgres.js serializes it, so values must not be stringified first. */
const json = (sql: Sql, value: unknown) => sql.json(value as postgres.JSONValue);

const OVERRIDABLE = ["beds", "baths", "sqft", "lot_sqft", "year_built", "stories", "parking_spaces"] as const;
const ERROR_SAMPLE_MAX = 25;

export async function runIngest(
  sql: Sql,
  adapter: ListingFeedAdapter & { inlineMedia?: InlineMedia },
  opts: { pageSize?: number; cursor?: string | null; geocode?: Geocoder; log?: (msg: string) => void } = {},
): Promise<IngestResult> {
  const pageSize = opts.pageSize ?? 1000;
  const log = opts.log ?? (() => {});
  const [run] = await sql<{ id: string }[]>`insert into feed_runs (source) values (${adapter.source}) returning id`;

  const cursor =
    opts.cursor !== undefined
      ? opts.cursor
      : ((
          await sql<{ cursor: string | null }[]>`
            select cursor from feed_runs
            where source = ${adapter.source} and status in ('success', 'partial') and cursor is not null
            order by started_at desc limit 1`
        )[0]?.cursor ?? null);

  const stats: IngestStats = {
    fetched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    removed: 0,
    media_queued: 0,
    errors: 0,
  };
  const errorSample: { id?: string; message: string }[] = [];
  const result: Omit<IngestResult, "runId" | "status" | "stats" | "cursor"> = {
    deactivatedListingIds: [],
    queuedMediaIds: [],
    soldPropertyIds: [],
  };
  let maxCursor = cursor;

  const recordError = (id: string | undefined, err: unknown) => {
    stats.errors++;
    if (errorSample.length < ERROR_SAMPLE_MAX) {
      errorSample.push({ id, message: err instanceof Error ? err.message.slice(0, 500) : String(err) });
    }
  };

  try {
    for await (const page of adapter.fetchChanged(cursor, pageSize)) {
      stats.fetched += page.items.length;
      const records: NormalizedListing[] = [];
      for (const raw of page.items) {
        try {
          const rec = adapter.normalize(raw);
          if (!rec.location) {
            const loc = opts.geocode ? await opts.geocode(rec.address) : null;
            if (!loc) throw new Error("No location and address could not be geocoded");
            rec.location = loc;
          }
          records.push(rec);
        } catch (err) {
          recordError(typeof raw.sourceListingId === "string" ? raw.sourceListingId : undefined, err);
        }
      }
      if (records.length) await ingestPage(sql, adapter, records, stats, result);
      if (page.nextCursor && (!maxCursor || page.nextCursor > maxCursor)) maxCursor = page.nextCursor;
      log(
        `ingested ${stats.fetched} (created ${stats.created}, updated ${stats.updated}, unchanged ${stats.unchanged})`,
      );
    }
  } catch (err) {
    recordError(undefined, err);
    await sql`
      update feed_runs set status = 'failed', finished_at = now(), stats = ${sql.json(stats)},
        error_sample = ${sql.json(errorSample)}
      where id = ${run.id}`;
    throw err;
  }

  const status: IngestResult["status"] =
    stats.errors === 0 ? "success" : stats.errors < stats.fetched * 0.02 ? "partial" : "failed";
  await sql`
    update feed_runs set status = ${status}, finished_at = now(), stats = ${sql.json(stats)},
      error_sample = ${errorSample.length ? sql.json(errorSample) : null}, cursor = ${maxCursor}
    where id = ${run.id}`;

  return { runId: run.id, status, stats, cursor: maxCursor, ...result };
}

async function ingestPage(
  sql: Sql,
  adapter: ListingFeedAdapter & { inlineMedia?: InlineMedia },
  records: NormalizedListing[],
  stats: IngestStats,
  out: Omit<IngestResult, "runId" | "status" | "stats" | "cursor">,
) {
  // ---- b. properties ----
  const propKey = (r: NormalizedListing) =>
    `${normalizeAddress(r.address.line1, r.address.line2)}|${normalizePostalCode(r.address.postalCode)}`;
  const propRows = new Map<string, Record<string, unknown>>();
  for (const r of records) {
    propRows.set(propKey(r), {
      address_line1: r.address.line1,
      address_line2: r.address.line2 ?? null,
      city: r.address.city,
      region_code: r.address.regionCode,
      postal_code: normalizePostalCode(r.address.postalCode),
      country: r.address.country,
      address_normalized: normalizeAddress(r.address.line1, r.address.line2),
      lng: r.location!.lng,
      lat: r.location!.lat,
      property_type: r.propertyType,
      beds: r.beds ?? null,
      baths: r.baths ?? null,
      sqft: r.sqft ?? null,
      lot_sqft: r.lotSqft ?? null,
      year_built: r.yearBuilt ?? null,
      stories: r.stories ?? null,
      parking_spaces: r.parkingSpaces ?? null,
      facts: r.facts,
    });
  }

  // Feed values win unless null or the owner overrode that field (docs/03 step b).
  const overridden = (f: string) => `coalesce(properties.owner_facts_override ? '${f}', false)`;
  const setFacts = OVERRIDABLE.map(
    (f) => `${f} = case when ${overridden(f)} or excluded.${f} is null then properties.${f} else excluded.${f} end`,
  ).join(",\n      ");
  const changed = OVERRIDABLE.map(
    (f) => `(not ${overridden(f)} and excluded.${f} is not null and excluded.${f} is distinct from properties.${f})`,
  ).join(" or ");

  await sql.unsafe(
    `insert into properties (address_line1, address_line2, city, region_code, postal_code, country, address_normalized,
       location, city_region_id, neighborhood_region_id, property_type, beds, baths, sqft, lot_sqft, year_built, stories,
       parking_spaces, facts, source)
     select x.address_line1, x.address_line2, x.city, x.region_code, x.postal_code, x.country, x.address_normalized,
       g.geog,
       coalesce(hood.parent_id, city.id),
       hood.id,
       x.property_type, x.beds, x.baths, x.sqft, x.lot_sqft, x.year_built, x.stories, x.parking_spaces,
       coalesce(x.facts, '{}'::jsonb), 'feed'
     from jsonb_to_recordset($1::jsonb) as x(address_line1 text, address_line2 text, city text, region_code text,
       postal_code text, country text, address_normalized text, lng float8, lat float8, property_type text,
       beds numeric, baths numeric, sqft int, lot_sqft int, year_built int, stories int, parking_spaces int, facts jsonb)
     cross join lateral (select ST_SetSRID(ST_MakePoint(x.lng, x.lat), 4326)::geography as geog) g
     -- On a shared border a point can sit in two regions; prefer the one matching the address city.
     left join lateral (
       select r.id from regions r
       where r.type = 'city' and ST_Covers(r.boundary, g.geog)
       order by lower(r.name) = lower(x.city) desc limit 1
     ) city on true
     left join lateral (
       select r.id, r.parent_id from regions r join regions c on c.id = r.parent_id
       where r.type = 'neighborhood' and ST_Covers(r.boundary, g.geog)
       order by lower(c.name) = lower(x.city) desc limit 1
     ) hood on true
     on conflict (address_normalized, postal_code) do update set
      property_type = excluded.property_type,
      ${setFacts},
      facts = properties.facts || excluded.facts,
      updated_at = now()
     where properties.property_type is distinct from excluded.property_type
       or properties.facts is distinct from (properties.facts || excluded.facts)
       or ${changed}`,
    [json(sql, [...propRows.values()])],
  );

  const propIds = await sql.unsafe<{ id: string; address_normalized: string; postal_code: string }[]>(
    `select p.id, p.address_normalized, p.postal_code
     from properties p
     join jsonb_to_recordset($1::jsonb) as x(address_normalized text, postal_code text)
       on p.address_normalized = x.address_normalized and p.postal_code = x.postal_code`,
    [
      json(
        sql,
        [...propRows.values()].map((p) => ({ address_normalized: p.address_normalized, postal_code: p.postal_code })),
      ),
    ],
  );
  const propertyIdByKey = new Map(propIds.map((p) => [`${p.address_normalized}|${p.postal_code}`, p.id]));

  // ---- c. listings ----
  const existing = await sql.unsafe<
    { id: string; source_listing_id: string; status: string; price: number; source_updated_at: Date | null }[]
  >(
    `select id, source_listing_id, status, price, source_updated_at from listings
     where source = $1 and source_listing_id in (select jsonb_array_elements_text($2::jsonb))`,
    [
      adapter.source,
      json(
        sql,
        records.map((r) => r.sourceListingId),
      ),
    ],
  );
  const existingById = new Map(existing.map((e) => [e.source_listing_id, e]));

  const toWrite: { rec: NormalizedListing; propertyId: string; prev: (ExistingListing & { id: string }) | null }[] = [];
  // Within a page the last record for a listing wins.
  const latest = new Map<string, NormalizedListing>();
  for (const r of records) latest.set(r.sourceListingId, r);
  for (const rec of latest.values()) {
    const prev = existingById.get(rec.sourceListingId);
    if (prev?.source_updated_at && prev.source_updated_at.getTime() >= Date.parse(rec.sourceUpdatedAt)) {
      stats.unchanged++;
      continue;
    }
    toWrite.push({
      rec,
      propertyId: propertyIdByKey.get(propKey(rec))!,
      prev: prev ? { id: prev.id, status: prev.status, price: prev.price } : null,
    });
  }
  if (!toWrite.length) return;

  const listingRows = toWrite.map(({ rec, propertyId }) => ({
    property_id: propertyId,
    listing_type: rec.listingType,
    status: rec.status,
    source_listing_id: rec.sourceListingId,
    source_updated_at: rec.sourceUpdatedAt,
    price: rec.price,
    original_price: rec.originalPrice ?? null,
    sold_price: rec.soldPrice ?? null,
    list_date: rec.listDate,
    status_date: rec.statusDate,
    sold_date: rec.soldDate ?? null,
    available_date: rec.availableDate ?? null,
    description: rec.description ?? null,
    features: rec.features,
    rental_terms: rec.rentalTerms ?? null,
    hoa_fee: rec.hoaFee ?? null,
    tax_annual: rec.taxAnnual ?? null,
    virtual_tour_url: rec.virtualTourUrl ?? null,
    agent_license: rec.agent?.licenseNumber ?? null,
    brokerage_name: rec.agent?.brokerage ?? null,
  }));

  const written = await sql.unsafe<{ id: string; source_listing_id: string; inserted: boolean }[]>(
    `insert into listings (property_id, listing_type, status, source, source_listing_id, source_updated_at, price,
       price_currency, original_price, sold_price, list_date, status_date, sold_date, available_date, description,
       features, rental_terms, hoa_fee, tax_annual, virtual_tour_url, listing_agent_id, brokerage_name)
     select x.property_id, x.listing_type, x.status, $2, x.source_listing_id, x.source_updated_at, x.price, $3,
       x.original_price, x.sold_price, x.list_date, x.status_date, x.sold_date, x.available_date, x.description,
       coalesce(x.features, '{}'::jsonb), x.rental_terms, x.hoa_fee, x.tax_annual, x.virtual_tour_url,
       (select p.id from pros p where p.license_number = x.agent_license limit 1), x.brokerage_name
     from jsonb_to_recordset($1::jsonb) as x(property_id uuid, listing_type text, status text, source_listing_id text,
       source_updated_at timestamptz, price int, original_price int, sold_price int, list_date date, status_date date,
       sold_date date, available_date date, description text, features jsonb, rental_terms jsonb, hoa_fee int,
       tax_annual int, virtual_tour_url text, agent_license text, brokerage_name text)
     on conflict (source, source_listing_id) do update set
       property_id = excluded.property_id, listing_type = excluded.listing_type, status = excluded.status,
       source_updated_at = excluded.source_updated_at, price = excluded.price, original_price = excluded.original_price,
       sold_price = excluded.sold_price, list_date = excluded.list_date, status_date = excluded.status_date,
       sold_date = excluded.sold_date, available_date = excluded.available_date, description = excluded.description,
       features = excluded.features, rental_terms = excluded.rental_terms, hoa_fee = excluded.hoa_fee,
       tax_annual = excluded.tax_annual, virtual_tour_url = excluded.virtual_tour_url,
       listing_agent_id = excluded.listing_agent_id, brokerage_name = excluded.brokerage_name, updated_at = now()
     returning id, source_listing_id, (xmax = 0) as inserted`,
    [json(sql, listingRows), adapter.source, brand.currency],
  );
  const listingIdBySource = new Map(written.map((w) => [w.source_listing_id, w.id]));
  for (const w of written) {
    if (w.inserted) stats.created++;
    else stats.updated++;
  }

  // ---- price events ----
  const eventRows: (PlannedEvent & { property_id: string; listing_id: string })[] = [];
  for (const { rec, propertyId, prev } of toWrite) {
    const listingId = listingIdBySource.get(rec.sourceListingId)!;
    for (const e of planListingEvents(prev, rec))
      eventRows.push({ ...e, property_id: propertyId, listing_id: listingId });
    const wasActive = !prev || prev.status === "active";
    if (prev && wasActive && rec.status !== "active") out.deactivatedListingIds.push(listingId);
    if (prev && prev.status !== rec.status && (rec.status === "withdrawn" || rec.status === "expired")) stats.removed++;
  }
  if (eventRows.length) {
    await sql.unsafe(
      `insert into listing_price_events (property_id, listing_id, event_type, price, event_date, source)
       select x.property_id, x.listing_id, x.event_type, x.price, x.event_date, $2
       from jsonb_to_recordset($1::jsonb) as x(property_id uuid, listing_id uuid, event_type text, price int, event_date date)`,
      [
        json(
          sql,
          eventRows.map((e) => ({
            property_id: e.property_id,
            listing_id: e.listing_id,
            event_type: e.eventType,
            price: e.price,
            event_date: e.date,
          })),
        ),
        adapter.source,
      ],
    );
  }

  // ---- last sale on the property ----
  const sold = toWrite.filter(({ rec }) => rec.status === "sold" && rec.soldPrice && rec.soldDate);
  if (sold.length) {
    const updated = await sql.unsafe<{ id: string }[]>(
      `update properties p set last_sold_price = x.price, last_sold_at = x.sold_at, updated_at = now()
       from jsonb_to_recordset($1::jsonb) as x(property_id uuid, price int, sold_at date)
       where p.id = x.property_id and (p.last_sold_at is null or p.last_sold_at < x.sold_at)
       returning p.id`,
      [
        json(
          sql,
          sold.map(({ rec, propertyId }) => ({ property_id: propertyId, price: rec.soldPrice, sold_at: rec.soldDate })),
        ),
      ],
    );
    out.soldPropertyIds.push(...updated.map((u) => u.id));
  }

  // ---- d. media diff ----
  const listingIds = [...listingIdBySource.values()];
  const currentMedia = await sql.unsafe<{ id: string; listing_id: string; source_url: string | null }[]>(
    `select id, listing_id, source_url from listing_media where listing_id in (select (jsonb_array_elements_text($1::jsonb))::uuid)`,
    [json(sql, listingIds)],
  );
  const byListing = new Map<string, Map<string, string>>();
  for (const m of currentMedia) {
    if (!byListing.has(m.listing_id)) byListing.set(m.listing_id, new Map());
    byListing.get(m.listing_id)!.set(m.source_url ?? "", m.id);
  }

  const inserts: Record<string, unknown>[] = [];
  const removals: string[] = [];
  for (const { rec } of toWrite) {
    const listingId = listingIdBySource.get(rec.sourceListingId)!;
    const have = byListing.get(listingId) ?? new Map<string, string>();
    const want = new Set(rec.media.map((m) => m.url));
    for (const m of rec.media) {
      if (have.has(m.url)) continue;
      const inline = adapter.inlineMedia?.(m.url) ?? null;
      inserts.push({
        listing_id: listingId,
        kind: m.kind,
        position: m.position,
        source_url: m.url,
        caption: m.caption ?? null,
        storage_key: inline?.storageKey ?? null,
        blur_data_url: inline?.blurDataUrl ?? null,
        width: inline?.width ?? null,
        height: inline?.height ?? null,
        processed: !!inline,
      });
    }
    for (const [url, id] of have) if (!want.has(url)) removals.push(id);
  }
  if (removals.length) {
    await sql.unsafe(`delete from listing_media where id in (select (jsonb_array_elements_text($1::jsonb))::uuid)`, [
      json(sql, removals),
    ]);
  }
  if (inserts.length) {
    const queued = await sql.unsafe<{ id: string; processed_at: Date | null }[]>(
      `insert into listing_media (listing_id, kind, position, source_url, caption, storage_key, blur_data_url, width, height, processed_at)
       select x.listing_id, x.kind, x.position, x.source_url, x.caption, x.storage_key, x.blur_data_url, x.width, x.height,
         case when x.processed then now() end
       from jsonb_to_recordset($1::jsonb) as x(listing_id uuid, kind text, position int, source_url text, caption text,
         storage_key text, blur_data_url text, width int, height int, processed boolean)
       returning id, processed_at`,
      [json(sql, inserts)],
    );
    const needsProcessing = queued.filter((q) => !q.processed_at);
    stats.media_queued += needsProcessing.length;
    out.queuedMediaIds.push(...needsProcessing.map((q) => q.id));
  }
}
