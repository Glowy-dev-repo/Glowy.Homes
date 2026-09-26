import type postgres from "postgres";
import { sqlClient } from "@/db";
import {
  CLUSTER_THRESHOLD,
  PAGE_SIZE,
  type ListingSummary,
  type SearchCluster,
  type SearchParams,
  type SearchPin,
  type SearchResult,
} from "@/types/search";
import { findCity, findNeighborhood } from "./regions";

// Postgres search strategy (docs/02 section 6). PostGIS for bounds and polygons, full text on
// listings.search_vector, grid clusters when a search matches more than 200 listings.

type Sql = postgres.Sql;
type Fragment = postgres.PendingQuery<postgres.Row[]>;

/**
 * Grid cell size in degrees: about 10 columns across the viewport (or the searched region when
 * no viewport is known yet), so cluster markers do not overlap.
 */
export function clusterCellSize(extent: [number, number, number, number] | null | undefined): number {
  if (!extent) return 0.05;
  const [w, s, e, n] = extent;
  return Math.max((e - w) / 10, (n - s) / 8, 0.0005);
}

export function polygonWkt(polygon: [number, number][]): string {
  const ring = [...polygon];
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx !== lx || fy !== ly) ring.push(ring[0]);
  return `SRID=4326;POLYGON((${ring.map(([x, y]) => `${x} ${y}`).join(", ")}))`;
}

// Returns { where } rather than the fragment itself: postgres.js fragments are thenables, and an
// async function returning one would await it, executing the fragment as a standalone query.
async function whereClause(
  sql: Sql,
  p: SearchParams,
): Promise<{ where: Fragment; extent: [number, number, number, number] | null } | null> {
  const conds: Fragment[] = [sql`l.listing_type = ${p.type}`, sql`l.status = any(${p.status}::text[])`];
  let extent = p.bounds ?? null;

  if (p.city) {
    const city = await findCity(p.city);
    if (!city) return null;
    conds.push(sql`l.city_region_id = ${city.id}`);
    extent ??= city.bbox;
  }
  if (p.neighborhood) {
    const hood = await findNeighborhood(p.city, p.neighborhood);
    if (!hood) return null;
    conds.push(sql`l.neighborhood_region_id = ${hood.id}`);
    if (!p.bounds) extent = hood.bbox;
  }
  if (p.bounds) {
    const [w, s, e, n] = p.bounds;
    conds.push(sql`ST_Intersects(l.location, ST_MakeEnvelope(${w}, ${s}, ${e}, ${n}, 4326)::geography)`);
  }
  if (p.polygon) conds.push(sql`ST_Covers(ST_GeogFromText(${polygonWkt(p.polygon)}), l.location)`);
  if (p.q) conds.push(sql`l.search_vector @@ websearch_to_tsquery('english', ${p.q})`);
  if (p.keywords) conds.push(sql`l.search_vector @@ plainto_tsquery('english', ${p.keywords})`);
  if (p.priceMin !== undefined) conds.push(sql`l.price >= ${p.priceMin}`);
  if (p.priceMax !== undefined) conds.push(sql`l.price <= ${p.priceMax}`);
  if (p.bedsMin !== undefined) conds.push(sql`l.beds >= ${p.bedsMin}`);
  if (p.bathsMin !== undefined) conds.push(sql`l.baths >= ${p.bathsMin}`);
  if (p.propertyTypes?.length) conds.push(sql`l.property_type = any(${p.propertyTypes}::text[])`);
  if (p.sqftMin !== undefined) conds.push(sql`l.sqft >= ${p.sqftMin}`);
  if (p.sqftMax !== undefined) conds.push(sql`l.sqft <= ${p.sqftMax}`);
  if (p.yearBuiltMin !== undefined) {
    conds.push(sql`exists (select 1 from properties yp where yp.id = l.property_id and yp.year_built >= ${p.yearBuiltMin})`);
  }
  if (p.daysOnMarketMax !== undefined) conds.push(sql`l.list_date >= current_date - ${p.daysOnMarketMax}::int`);
  if (p.pets !== undefined) conds.push(sql`coalesce((l.rental_terms->>'pets')::boolean, false) = ${p.pets}`);
  if (p.furnished !== undefined) conds.push(sql`coalesce((l.rental_terms->>'furnished')::boolean, false) = ${p.furnished}`);
  if (p.laundry !== undefined) conds.push(sql`(coalesce(l.rental_terms->>'laundry', '') = 'In suite') = ${p.laundry}`);
  if (p.parking !== undefined) conds.push(sql`coalesce((l.rental_terms->>'parking')::boolean, false) = ${p.parking}`);
  if (p.availableBy) conds.push(sql`l.available_date <= ${p.availableBy}::date`);

  return { where: conds.reduce((acc, c) => sql`${acc} and ${c}`), extent };
}

/** Featured placement is capped (docs/01 SE3, docs/05 Phase 5): at most this many boosted slots, at the top of page 1. */
export const MAX_FEATURED_PER_PAGE = 4;

function orderBy(sql: Sql, sort: SearchParams["sort"]): Fragment {
  switch (sort) {
    case "price_asc":
      return sql`l.price asc, l.id`;
    case "price_desc":
      return sql`l.price desc, l.id`;
    case "sqft_desc":
      return sql`l.sqft desc nulls last, l.id`;
    case "ppsf_asc":
      return sql`(l.price::float8 / nullif(l.sqft, 0)) asc nulls last, l.id`;
    default:
      return sql`l.list_date desc, l.id`;
  }
}

/** Shared card columns: search results, similar homes, saved homes and browse pages all use them. */
export function summaryColumns(sql: Sql): Fragment {
  return sql`
    l.id, l.listing_type as "listingType", l.status, l.price, l.sold_price as "soldPrice",
    l.beds::float8 as beds, l.baths::float8 as baths, l.sqft, l.property_type as "propertyType",
    l.list_date::text as "listDate", l.status_date::text as "statusDate", l.is_featured as "isFeatured",
    l.brokerage_name as "brokerageName", p.address_line1 as "addressLine1", p.address_line2 as "addressLine2",
    p.city, ST_Y(l.location::geometry) as lat, ST_X(l.location::geometry) as lng,
    m.storage_key as "coverKey", m.blur_data_url as "coverBlur"`;
}

export function coverJoin(sql: Sql): Fragment {
  return sql`
    left join lateral (
      select storage_key, blur_data_url from listing_media
      where listing_id = l.id and kind = 'photo' and storage_key is not null
      order by position limit 1
    ) m on true`;
}

export async function searchListings(p: SearchParams, sql: Sql = sqlClient): Promise<SearchResult> {
  const clause = await whereClause(sql, p);
  if (!clause) return { items: [], total: 0 };
  const { where, extent } = clause;

  const offset = (p.page - 1) * PAGE_SIZE;
  const [items, [{ total }]] = await Promise.all([
    sql<ListingSummary[]>`
      with pinned as (
        select l.id from listings l where ${where} and l.is_featured
        order by ${orderBy(sql, p.sort)} limit ${MAX_FEATURED_PER_PAGE}
      )
      select ${summaryColumns(sql)}
      from listings l
      join properties p on p.id = l.property_id
      ${coverJoin(sql)}
      where ${where}
      order by (l.id in (select id from pinned)) desc, ${orderBy(sql, p.sort)}
      limit ${PAGE_SIZE} offset ${offset}`,
    sql<{ total: number }[]>`select count(*)::int as total from listings l where ${where}`,
  ]);

  const result: SearchResult = { items, total };
  if (total > CLUSTER_THRESHOLD) {
    const cell = clusterCellSize(extent);
    result.clusters = await sql<SearchCluster[]>`
      select count(*)::int as count, avg(y)::float8 as lat, avg(x)::float8 as lng, min(price)::int as "minPrice",
        json_build_array(min(x), min(y), max(x), max(y)) as bounds
      from (
        select l.price, ST_X(l.location::geometry) as x, ST_Y(l.location::geometry) as y
        from listings l where ${where}
      ) t
      group by floor(x / ${cell}), floor(y / ${cell})`;
  } else {
    result.pins = await sql<SearchPin[]>`
      select l.id, ST_Y(l.location::geometry) as lat, ST_X(l.location::geometry) as lng, l.price
      from listings l where ${where}`;
  }
  return result;
}
