import { sqlClient } from "@/db";
import { normalizeStreet } from "@/lib/ingestion/address";
import { addressSlug } from "@/lib/slug";
import { allRegions } from "./regions";

// /api/autocomplete (docs/02 section 5, docs/04 SearchBar): grouped Places, Addresses, Listing IDs; max 8.

/** point is [lng, lat], used by the commute estimate. */
export type Suggestion =
  | { group: "places"; label: string; sublabel: string; href: string; type: "city" | "neighborhood"; point?: [number, number] }
  | { group: "addresses"; label: string; sublabel: string; href: string; point?: [number, number] }
  | { group: "listings"; label: string; sublabel: string; href: string; point?: [number, number] };

const MAX = 8;

export async function autocomplete(q: string, type: "sale" | "rent" = "sale"): Promise<Suggestion[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const lower = query.toLowerCase();
  const browse = type === "rent" ? "rentals" : "homes";

  const places: Suggestion[] = (await allRegions())
    .filter((r) => r.name.toLowerCase().startsWith(lower) || r.name.toLowerCase().includes(` ${lower}`))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "city" ? -1 : 1))
    .slice(0, 4)
    .map((r) => ({
      group: "places",
      type: r.type,
      label: r.name,
      sublabel: r.type === "city" ? "City" : `Neighborhood in ${r.parentName}`,
      href: r.type === "city" ? `/${browse}/${r.slug}` : `/homes/${r.parentSlug}/${r.slug}`,
      point: r.bbox ? ([(r.bbox[0] + r.bbox[2]) / 2, (r.bbox[1] + r.bbox[3]) / 2] as [number, number]) : undefined,
    }));

  const listingIds: Suggestion[] = /^gh\d{2,}/i.test(query)
    ? (
        await sqlClient<{ id: string; sid: string; line1: string; line2: string | null; city: string }[]>`
          select l.id, l.source_listing_id as sid, p.address_line1 as line1, p.address_line2 as line2, p.city
          from listings l join properties p on p.id = l.property_id
          where upper(l.source_listing_id) like ${`${query.toUpperCase()}%`}
          order by l.source_listing_id limit 3`
      ).map((r) => ({
        group: "listings",
        label: r.sid,
        sublabel: [r.line2, r.line1, r.city].filter(Boolean).join(", "),
        href: `/listing/${r.id}/${addressSlug(r.line1, r.line2, r.city)}`,
      }))
    : [];

  const addresses: Suggestion[] = /\d/.test(query)
    ? (
        await sqlClient<{ property_id: string; listing_id: string | null; line1: string; line2: string | null; city: string; lng: number; lat: number }[]>`
          select p.id as property_id, p.address_line1 as line1, p.address_line2 as line2, p.city,
            ST_X(p.location::geometry) as lng, ST_Y(p.location::geometry) as lat,
            (select l.id from listings l where l.property_id = p.id order by (l.status = 'active') desc, l.list_date desc limit 1) as listing_id
          from properties p
          where p.address_normalized like ${`${normalizeStreet(query)}%`}
          order by p.address_normalized limit ${MAX - places.length - listingIds.length}`
      ).map((r) => {
        const slug = addressSlug(r.line1, r.line2, r.city);
        return {
          group: "addresses",
          label: [r.line2, r.line1].filter(Boolean).join(", "),
          sublabel: r.city,
          href: r.listing_id ? `/listing/${r.listing_id}/${slug}` : `/home-value/${r.property_id}/${slug}`,
          point: [r.lng, r.lat] as [number, number],
        };
      })
    : [];

  return [...places, ...addresses, ...listingIds].slice(0, MAX);
}
