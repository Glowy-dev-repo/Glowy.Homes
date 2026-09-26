import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { runIngest } from "../src/lib/ingestion/ingest";
import { SYNTHETIC_FEED_PATH, syntheticAdapter } from "../src/lib/ingestion/adapters/synthetic";
import { generateMarket, type GeneratedMarket } from "../src/lib/ingestion/synthetic/generate";
import { refreshRegionStats } from "../src/lib/regions/stats";
import { generateRegionSummaries } from "../src/lib/regions/summary";
import { backtestAccuracy, nightlyScope, refreshValuations } from "../src/lib/valuation/engine";

// Deterministic synthetic market: regions with boundaries, 50,000 listings through the real
// ingestion path, 200 pros with service areas, 20 test consumers and 1 admin.
// Env: SEED (default 42), SEED_LISTINGS (default 50000), SEED_AS_OF (YYYY-MM-DD, default today UTC),
// SEED_ADMIN_EMAIL (default admin@example.com).

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1"].includes(host) && process.env.ALLOW_REMOTE_SEED !== "1") {
  throw new Error(`Refusing to seed non local database at ${host}. Set ALLOW_REMOTE_SEED=1 to override.`);
}

const SEED = Number(process.env.SEED ?? 42);
const TOTAL = Number(process.env.SEED_LISTINGS ?? 50_000);
const AS_OF = process.env.SEED_AS_OF ? new Date(`${process.env.SEED_AS_OF}T00:00:00Z`) : new Date(new Date().toISOString().slice(0, 10));
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
export const TRUTH_PATH = resolve(process.cwd(), "scripts/data/generated/truth.jsonl");

const sql = postgres(url, { max: 10, onnotice: () => {} });
const started = Date.now();
const lap = (label: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(1)}s] ${label}`);

async function wipe() {
  await sql`
    truncate table valuation_accuracy, property_claims, listing_price_events, listing_media, valuations, saved_homes, saved_home_shares, alert_sends, saved_searches, recently_viewed,
      rental_application_submissions, rental_applications, lead_messages, pro_reviews, leads, listings, properties,
      pro_service_areas, pros, moderation_items, feed_runs, events, sessions, accounts, verification_tokens, users, regions
    restart identity cascade`;
}

async function insertRegions(market: GeneratedMarket) {
  const [country] = await sql<{ id: string }[]>`
    insert into regions (type, name, slug) values ('country', 'Canada', 'canada') returning id`;
  const [province] = await sql<{ id: string }[]>`
    insert into regions (type, name, slug, parent_id) values ('province', 'Ontario', 'ontario', ${country.id}) returning id`;

  for (const city of market.cities) {
    const ring = city.boundary.map(([lng, lat]) => `${lng} ${lat}`).join(", ");
    const [row] = await sql<{ id: string }[]>`
      insert into regions (type, name, slug, parent_id, boundary, centroid, stats)
      values ('city', ${city.name}, ${city.slug}, ${province.id},
        ST_GeogFromText(${`SRID=4326;MULTIPOLYGON(((${ring})))`}),
        ST_GeogFromText(${`SRID=4326;POINT(${city.center[0]} ${city.center[1]})`}),
        ${sql.json({ timezone: city.timezone })})
      returning id`;

    // Neighborhood boundaries: Voronoi cells of the seed points, clipped to the city.
    const seeds = city.hoods.map((h) => ({ name: h.name, slug: h.slug, lng: h.point[0], lat: h.point[1], fsa: h.fsa }));
    await sql.unsafe(
      `with pts as (
         select x.*, ST_SetSRID(ST_MakePoint(x.lng, x.lat), 4326) as geom
         from jsonb_to_recordset($1::jsonb) as x(name text, slug text, lng float8, lat float8, fsa text)
       ),
       city as (select boundary::geometry as g from regions where id = $2),
       cells as (
         select (ST_Dump(ST_VoronoiPolygons(ST_Collect(p.geom), 0, (select ST_Expand(ST_Envelope(g), 0.2) from city)))).geom as cell
         from pts p
       )
       insert into regions (type, name, slug, parent_id, boundary, centroid, stats)
       select 'neighborhood', p.name, p.slug, $2,
         ST_Multi(ST_CollectionExtract(ST_Intersection(c.cell, (select g from city)), 3))::geography,
         p.geom::geography, jsonb_build_object('fsa', p.fsa)
       from pts p join cells c on ST_Contains(c.cell, p.geom)`,
      [sql.json(seeds), row.id],
    );
  }
}

async function insertPeople(market: GeneratedMarket) {
  await sql`
    insert into users (email, name, roles, email_verified_at)
    values (${ADMIN_EMAIL}, 'Site Admin', ${sql.array(["consumer", "admin"])}, now())`;
  const consumers = Array.from({ length: 20 }, (_, i) => ({
    email: `consumer${String(i + 1).padStart(2, "0")}@example.com`,
    name: `Test Consumer ${i + 1}`,
  }));
  await sql`insert into users ${sql(consumers, "email", "name")}`;

  const regionIds = new Map(
    (await sql<{ id: string; key: string }[]>`
      select r.id, case when r.type = 'city' then r.slug else p.slug || '/' || r.slug end as key
      from regions r left join regions p on p.id = r.parent_id
      where r.type in ('city', 'neighborhood')`).map((r) => [r.key, r.id]),
  );

  for (const pro of market.pros) {
    const role = pro.proType === "property_manager" ? "landlord" : pro.proType;
    const [user] = await sql<{ id: string }[]>`
      insert into users (email, name, phone, roles, email_verified_at)
      values (${pro.email}, ${pro.displayName}, ${pro.phone}, ${sql.array(["consumer", role])}, now())
      returning id`;
    const [row] = await sql<{ id: string }[]>`
      insert into pros (user_id, pro_type, slug, display_name, brokerage_name, license_number, license_region,
        license_verified_at, phone, bio, languages, years_experience, rating, review_count, response_time_minutes, status)
      values (${user.id}, ${pro.proType}, ${`${pro.displayName.toLowerCase().replace(/[^a-z]+/g, "-")}-${pro.key}`},
        ${pro.displayName}, ${pro.brokerageName}, ${pro.licenseNumber}, ${pro.licenseNumber ? "ON" : null},
        ${pro.licenseNumber ? new Date() : null}, ${pro.phone}, ${pro.bio}, ${sql.array(pro.languages)},
        ${pro.yearsExperience}, ${pro.rating}, ${pro.reviewCount}, ${pro.responseTimeMinutes}, 'active')
      returning id`;
    const areas = pro.serviceAreas.map((key) => ({ pro_id: row.id, region_id: regionIds.get(key)! }));
    if (areas.length) await sql`insert into pro_service_areas ${sql(areas, "pro_id", "region_id")}`;
  }
}

function writeFeed(market: GeneratedMarket) {
  mkdirSync(dirname(SYNTHETIC_FEED_PATH), { recursive: true });
  writeFileSync(SYNTHETIC_FEED_PATH, market.listings.map((l) => JSON.stringify(l)).join("\n") + "\n");
  writeFileSync(TRUTH_PATH, market.truth.map((t) => JSON.stringify(t)).join("\n") + "\n");
}

async function main() {
  console.log(`Seeding ${TOTAL} synthetic listings (seed ${SEED}, as of ${AS_OF.toISOString().slice(0, 10)})`);
  const market = generateMarket({ seed: SEED, total: TOTAL, asOf: AS_OF });
  lap("generated market");

  await wipe();
  lap("wiped tables");
  await insertRegions(market);
  lap("inserted regions");
  await insertPeople(market);
  lap("inserted admin, consumers and 200 pros");
  writeFeed(market);
  lap(`wrote ${SYNTHETIC_FEED_PATH}`);

  const result = await runIngest(sql, syntheticAdapter(), { cursor: null, pageSize: 1000 });
  lap(`ingest ${result.status}: ${JSON.stringify(result.stats)}`);

  await refreshRegionStats(sql);
  await sql`analyze`;
  lap("region stats refreshed");
  const summaries = await generateRegionSummaries(sql, { force: true });
  lap(`region summaries: ${summaries}`);

  const scope = await nightlyScope(sql);
  const v = await refreshValuations(sql, scope, { refreshIndex: true, concurrency: 4 });
  lap(`valuations: ${v.valued} properties, ${v.insufficient} with insufficient data`);
  const scored = await backtestAccuracy(sql);
  lap(`accuracy backtest: ${scored} sales scored`);

  const [{ listings, properties, media, events }] = await sql`
    select (select count(*)::int from listings) as listings, (select count(*)::int from properties) as properties,
      (select count(*)::int from listing_media) as media, (select count(*)::int from listing_price_events) as events`;
  console.log(`listings ${listings}, properties ${properties}, media ${media}, price events ${events}`);
  console.log(`Admin: ${ADMIN_EMAIL}. Consumers: consumer01@example.com to consumer20@example.com.`);
  lap("done");
  await sql.end();
  if (result.status === "failed") process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
