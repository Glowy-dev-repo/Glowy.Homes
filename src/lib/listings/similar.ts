import { sqlClient } from "@/db";
import { coverJoin, summaryColumns } from "@/lib/search/postgres";
import type { ListingSummary } from "@/types/search";

// Similar homes (docs/01 LDP section 12): same type, within 20% of price, within 3 km.
// When fewer than 6 match, the rest are filled from a wider ring so the section is never thin.

export const SIMILAR_COUNT = 6;
export const SIMILAR_RADIUS_M = 3000;
export const SIMILAR_PRICE_BAND = 0.2;

export type SimilarListing = ListingSummary & { distanceM: number; strict: boolean };

export async function similarListings(id: string): Promise<SimilarListing[]> {
  const sql = sqlClient;
  const [subject] = await sql<{ price: number; listingType: string; propertyType: string }[]>`
    select price, listing_type as "listingType", property_type as "propertyType" from listings where id = ${id}`;
  if (!subject) return [];

  const low = Math.floor(subject.price * (1 - SIMILAR_PRICE_BAND));
  const high = Math.ceil(subject.price * (1 + SIMILAR_PRICE_BAND));

  const strict = await sql<SimilarListing[]>`
    select ${summaryColumns(sql)}, ST_Distance(l.location, s.location)::int as "distanceM", true as strict
    from listings s
    join listings l on l.listing_type = s.listing_type and l.property_type = s.property_type
      and l.status = 'active' and l.internet_display and l.id <> s.id
      and l.price between ${low} and ${high}
      and ST_DWithin(l.location, s.location, ${SIMILAR_RADIUS_M})
    join properties p on p.id = l.property_id
    ${coverJoin(sql)}
    where s.id = ${id}
    order by l.is_featured desc, l.location <-> s.location
    limit ${SIMILAR_COUNT}`;
  if (strict.length >= SIMILAR_COUNT) return strict;

  const exclude = [id, ...strict.map((s) => s.id)];
  const wider = await sql<SimilarListing[]>`
    select ${summaryColumns(sql)}, ST_Distance(l.location, s.location)::int as "distanceM", false as strict
    from listings s
    join listings l on l.listing_type = s.listing_type and l.property_type = s.property_type
      and l.status = 'active' and l.internet_display and l.id <> all(${exclude}::uuid[])
      and l.price between ${Math.floor(subject.price * 0.6)} and ${Math.ceil(subject.price * 1.4)}
      and ST_DWithin(l.location, s.location, 15000)
    join properties p on p.id = l.property_id
    ${coverJoin(sql)}
    where s.id = ${id}
    order by l.location <-> s.location
    limit ${SIMILAR_COUNT - strict.length}`;
  return [...strict, ...wider];
}
