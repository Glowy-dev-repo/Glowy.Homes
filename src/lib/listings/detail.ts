import { sqlClient } from "@/db";
import type { ListingFeatures, RentalTerms } from "@/db/schema/listings";
import type { RegionStats } from "@/db/schema/geo";

// Listing detail payload (docs/02 GET /api/listings/[id]): everything the LDP renders, in one place.

export type ListingMediaItem = { id: string; storageKey: string; blurDataUrl: string | null; caption: string | null; width: number | null; height: number | null };
export type PriceEvent = { id: string; eventType: string; price: number | null; eventDate: string; source: string; listingId: string | null };
export type ListingAgent = {
  id: string;
  slug: string;
  displayName: string;
  brokerageName: string | null;
  phone: string | null;
  photoUrl: string | null;
  rating: number | null;
  reviewCount: number;
};

export type ListingDetail = {
  id: string;
  propertyId: string;
  listingType: "sale" | "rent";
  status: string;
  source: string;
  sourceListingId: string | null;
  price: number;
  originalPrice: number | null;
  soldPrice: number | null;
  listDate: string;
  statusDate: string;
  soldDate: string | null;
  availableDate: string | null;
  description: string | null;
  features: ListingFeatures;
  rentalTerms: RentalTerms | null;
  hoaFee: number | null;
  taxAnnual: number | null;
  virtualTourUrl: string | null;
  brokerageName: string | null;
  isFeatured: boolean;
  saveCount: number;
  updatedAt: string;
  address: { line1: string; line2: string | null; city: string; regionCode: string; postalCode: string; country: string };
  lat: number;
  lng: number;
  propertyType: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  stories: number | null;
  parkingSpaces: number | null;
  facts: Record<string, unknown>;
  city: { id: string; name: string; slug: string; stats: RegionStats } | null;
  neighborhood: { id: string; name: string; slug: string; stats: RegionStats; summary: string | null } | null;
  media: ListingMediaItem[];
  priceHistory: PriceEvent[];
  agent: ListingAgent | null;
  /** Set for listings posted by owners and landlords (source fsbo or landlord). */
  contactPrefs: { preferred: "email" | "phone"; phone: string | null; showPhone: boolean } | null;
};

export function isOwnerListing(l: Pick<ListingDetail, "source">): boolean {
  return l.source === "fsbo" || l.source === "landlord";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export async function getListingDetail(id: string): Promise<ListingDetail | null> {
  if (!isUuid(id)) return null;
  const [row] = await sqlClient<(Omit<ListingDetail, "media" | "priceHistory" | "agent"> & { agentId: string | null })[]>`
    select l.id, l.property_id as "propertyId", l.listing_type as "listingType", l.status, l.source,
      l.source_listing_id as "sourceListingId", l.price, l.original_price as "originalPrice", l.sold_price as "soldPrice",
      l.list_date::text as "listDate", l.status_date::text as "statusDate", l.sold_date::text as "soldDate",
      l.available_date::text as "availableDate", l.description, l.features, l.rental_terms as "rentalTerms",
      l.hoa_fee as "hoaFee", l.tax_annual as "taxAnnual", l.virtual_tour_url as "virtualTourUrl",
      l.brokerage_name as "brokerageName", l.is_featured as "isFeatured", l.save_count as "saveCount",
      l.updated_at::text as "updatedAt", l.listing_agent_id as "agentId", l.contact_prefs as "contactPrefs",
      json_build_object('line1', p.address_line1, 'line2', p.address_line2, 'city', p.city, 'regionCode', p.region_code,
        'postalCode', p.postal_code, 'country', p.country) as address,
      ST_Y(l.location::geometry) as lat, ST_X(l.location::geometry) as lng,
      l.property_type as "propertyType", l.beds::float8 as beds, l.baths::float8 as baths, l.sqft,
      p.lot_sqft as "lotSqft", p.year_built as "yearBuilt", p.stories, p.parking_spaces as "parkingSpaces",
      p.facts || coalesce(p.owner_facts_override, '{}'::jsonb) as facts,
      case when c.id is null then null else json_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'stats', c.stats) end as city,
      case when n.id is null then null else json_build_object('id', n.id, 'name', n.name, 'slug', n.slug, 'stats', n.stats, 'summary', n.summary) end as neighborhood
    from listings l
    join properties p on p.id = l.property_id
    left join regions c on c.id = l.city_region_id
    left join regions n on n.id = l.neighborhood_region_id
    where l.id = ${id} and l.status not in ('draft', 'in_review', 'rejected')`;
  if (!row) return null;

  const [media, priceHistory, agents] = await Promise.all([
    sqlClient<ListingMediaItem[]>`
      select id, storage_key as "storageKey", blur_data_url as "blurDataUrl", caption, width, height
      from listing_media
      where listing_id = ${id} and kind = 'photo' and storage_key is not null
      order by position`,
    sqlClient<PriceEvent[]>`
      select id, event_type as "eventType", price, event_date::text as "eventDate", source, listing_id as "listingId"
      from listing_price_events
      where property_id = ${row.propertyId}
      order by event_date desc, id desc`,
    row.agentId
      ? sqlClient<ListingAgent[]>`
          select id, slug, display_name as "displayName", brokerage_name as "brokerageName", phone,
            photo_url as "photoUrl", rating::float8 as rating, review_count as "reviewCount"
          from pros where id = ${row.agentId} and status = 'active'`
      : Promise.resolve([] as ListingAgent[]),
  ]);

  const { agentId: _agentId, ...rest } = row;
  return { ...rest, media, priceHistory, agent: agents[0] ?? null };
}
