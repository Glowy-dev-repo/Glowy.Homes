import { sqlClient } from "@/db";
import { isUuid } from "@/lib/listings/detail";
import { coverJoin, summaryColumns } from "@/lib/search/postgres";
import type { ListingSummary } from "@/types/search";

export type OwnerOverrides = { beds?: number; baths?: number; sqft?: number; year_built?: number; condition?: string };

export type PropertyDetail = {
  id: string;
  address: { line1: string; line2: string | null; city: string; regionCode: string; postalCode: string };
  lat: number;
  lng: number;
  propertyType: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  overrides: OwnerOverrides;
  ownerUserId: string | null;
  ownerClaimedAt: string | null;
  lastSoldPrice: number | null;
  lastSoldAt: string | null;
  cityId: string | null;
  city: { name: string; slug: string } | null;
  neighborhood: { name: string; slug: string } | null;
  activeListingId: string | null;
};

export async function getPropertyDetail(id: string): Promise<PropertyDetail | null> {
  if (!isUuid(id)) return null;
  const [row] = await sqlClient<PropertyDetail[]>`
    select p.id,
      json_build_object('line1', p.address_line1, 'line2', p.address_line2, 'city', p.city, 'regionCode', p.region_code, 'postalCode', p.postal_code) as address,
      ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lng, p.property_type as "propertyType",
      p.beds::float8 as beds, p.baths::float8 as baths, p.sqft, p.lot_sqft as "lotSqft", p.year_built as "yearBuilt",
      coalesce(p.owner_facts_override, '{}'::jsonb) as overrides,
      p.owner_user_id as "ownerUserId", p.owner_claimed_at::text as "ownerClaimedAt",
      p.last_sold_price as "lastSoldPrice", p.last_sold_at::text as "lastSoldAt",
      p.city_region_id as "cityId",
      case when c.id is null then null else json_build_object('name', c.name, 'slug', c.slug) end as city,
      case when n.id is null then null else json_build_object('name', n.name, 'slug', n.slug) end as neighborhood,
      (select l.id from listings l where l.property_id = p.id and l.status in ('active', 'pending') order by l.list_date desc limit 1) as "activeListingId"
    from properties p
    left join regions c on c.id = p.city_region_id
    left join regions n on n.id = p.neighborhood_region_id
    where p.id = ${id}`;
  return row ?? null;
}

/** Effective facts: owner overrides win over feed facts. */
export function effectiveFacts(p: PropertyDetail) {
  return {
    beds: p.overrides.beds ?? p.beds,
    baths: p.overrides.baths ?? p.baths,
    sqft: p.overrides.sqft ?? p.sqft,
    yearBuilt: p.overrides.year_built ?? p.yearBuilt,
    condition: p.overrides.condition ?? null,
  };
}

/** Homes for sale near a property, same type first (docs/04 property value page). */
export async function nearbyForSale(p: PropertyDetail, limit = 6): Promise<ListingSummary[]> {
  const sql = sqlClient;
  return sql<ListingSummary[]>`
    select ${summaryColumns(sql)}
    from listings l join properties p on p.id = l.property_id
    ${coverJoin(sql)}
    where l.listing_type = 'sale' and l.status = 'active' and l.property_id <> ${p.id}
      and ST_DWithin(l.location, ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography, 5000)
    order by (l.property_type = ${p.propertyType}) desc, l.location <-> ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography
    limit ${limit}`;
}

export async function claimedProperties(userId: string): Promise<string[]> {
  const rows = await sqlClient<{ id: string }[]>`select id from properties where owner_user_id = ${userId} order by owner_claimed_at desc`;
  return rows.map((r) => r.id);
}
