import type postgres from "postgres";
import { configuredGeocoder, parseAddress, type Geocoder } from "@/lib/geocode";
import { normalizeAddress, normalizePostalCode } from "@/lib/ingestion/address";
import { addressSlug } from "@/lib/slug";
import { refreshValuations } from "@/lib/valuation/engine";

// Address to property (docs/02 GET /api/properties/lookup): find an existing property, or create
// one for an address inside a seeded city and value it immediately.

export type LookupResult =
  | { ok: true; propertyId: string; slug: string; created: boolean }
  | { ok: false; reason: "unparseable" | "not_found" | "outside_coverage"; message: string };

export async function lookupProperty(sql: postgres.Sql, input: string, geocoder: Geocoder = configuredGeocoder(sql)): Promise<LookupResult> {
  const parsed = parseAddress(input);
  if (!parsed) {
    return { ok: false, reason: "unparseable", message: "Enter a street address with a house number, like 12 Maple Ave, Toronto." };
  }
  const line1 = `${parsed.number} ${parsed.street}`;
  const normalized = normalizeAddress(line1, parsed.unit ? `Unit ${parsed.unit}` : null);

  const existing = await sql<{ id: string; line1: string; line2: string | null; city: string }[]>`
    select id, address_line1 as line1, address_line2 as line2, city from properties
    where address_normalized = ${normalized}
      and (${parsed.city}::text is null or lower(city) = lower(${parsed.city ?? null}))
      and (${parsed.postal}::text is null or postal_code = ${parsed.postal ?? null})
    order by created_at limit 1`;
  if (existing[0]) {
    const p = existing[0];
    return { ok: true, propertyId: p.id, slug: addressSlug(p.line1, p.line2, p.city), created: false };
  }

  const geo = await geocoder.geocode(parsed);
  if (!geo) {
    return { ok: false, reason: "not_found", message: "We could not find that address. Check the street name and city." };
  }
  const [regions] = await sql<{ city_id: string | null; hood_id: string | null }[]>`
    with pt as (select ST_SetSRID(ST_MakePoint(${geo.lng}, ${geo.lat}), 4326)::geography as g)
    select
      (select r.id from regions r, pt where r.type = 'neighborhood' and ST_Covers(r.boundary, pt.g) limit 1) as hood_id,
      coalesce(
        (select r.parent_id from regions r, pt where r.type = 'neighborhood' and ST_Covers(r.boundary, pt.g) limit 1),
        (select r.id from regions r, pt where r.type = 'city' and ST_Covers(r.boundary, pt.g) limit 1)
      ) as city_id`;
  if (!regions?.city_id) {
    return { ok: false, reason: "outside_coverage", message: "That address is outside the cities we cover today." };
  }

  const postal = geo.postalCode ? normalizePostalCode(geo.postalCode) : "";
  const unitLine = parsed.unit ? `Unit ${parsed.unit}` : null;
  const streetTitle = parsed.street.replace(/\b\w/g, (c) => c.toUpperCase());
  const [created] = await sql<{ id: string; line1: string; line2: string | null; city: string }[]>`
    insert into properties (address_line1, address_line2, city, region_code, postal_code, country, address_normalized,
      location, city_region_id, neighborhood_region_id, property_type, source)
    values (${`${parsed.number} ${streetTitle}`}, ${unitLine}, ${geo.city}, 'ON', ${postal}, 'CA', ${normalized},
      ST_SetSRID(ST_MakePoint(${geo.lng}, ${geo.lat}), 4326)::geography, ${regions.city_id}, ${regions.hood_id},
      ${geo.propertyType ?? "detached"}, 'lookup')
    on conflict (address_normalized, postal_code) do update set updated_at = now()
    returning id, address_line1 as line1, address_line2 as line2, city`;

  // Value it now so the property page opens with an estimate (or a clear not enough data state).
  await refreshValuations(sql, [created.id]);
  return { ok: true, propertyId: created.id, slug: addressSlug(created.line1, created.line2, created.city), created: true };
}
