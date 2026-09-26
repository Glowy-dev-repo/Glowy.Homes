import * as z from "zod/mini";
import { PROPERTY_TYPES } from "@/db/schema/listings";

// docs/02 section 4. Every search page, saved search and alert uses this one schema.

export const LISTING_SEARCH_STATUSES = ["active", "pending", "sold", "leased"] as const;
export const SORTS = ["newest", "price_asc", "price_desc", "sqft_desc", "ppsf_asc"] as const;

// zod/mini: this schema ships to the browser with the search page, and the mini build is a
// fraction of the classic one (docs/05 Phase 6 task 6). Same parsing, functional syntax.
const opt = z.optional;
const int = () => z.number().check(z.int());
export const SearchParams = z.object({
  type: z._default(z.enum(["sale", "rent"]), "sale"),
  status: z._default(z.array(z.enum(LISTING_SEARCH_STATUSES)).check(z.minLength(1)), ["active"]),
  q: opt(z.string().check(z.trim(), z.maxLength(200))),
  city: opt(z.string().check(z.maxLength(80))),
  neighborhood: opt(z.string().check(z.maxLength(80))),
  bounds: opt(
    z.tuple([
      z.number().check(z.minimum(-180), z.maximum(180)),
      z.number().check(z.minimum(-90), z.maximum(90)),
      z.number().check(z.minimum(-180), z.maximum(180)),
      z.number().check(z.minimum(-90), z.maximum(90)),
    ]),
  ),
  polygon: opt(z.array(z.tuple([z.number(), z.number()])).check(z.minLength(3), z.maxLength(200))),
  priceMin: opt(int().check(z.nonnegative())),
  priceMax: opt(int().check(z.positive())),
  bedsMin: opt(z.number().check(z.minimum(0), z.maximum(10))),
  bathsMin: opt(z.number().check(z.minimum(0), z.maximum(10))),
  propertyTypes: opt(z.array(z.enum(PROPERTY_TYPES))),
  sqftMin: opt(int()),
  sqftMax: opt(int()),
  yearBuiltMin: opt(int()),
  daysOnMarketMax: opt(int()),
  keywords: opt(z.string().check(z.trim(), z.maxLength(200))),
  /** Parking included (rentals) or at least one parking space (sales). */
  parking: opt(z.boolean()),
  // rental only
  pets: opt(z.boolean()),
  furnished: opt(z.boolean()),
  /** In suite laundry. */
  laundry: opt(z.boolean()),
  availableBy: opt(z.iso.date()),
  sort: z._default(z.enum(SORTS), "newest"),
  page: z._default(int().check(z.minimum(1)), 1),
});

export type SearchParams = z.infer<typeof SearchParams>;
export type SearchParamsInput = z.input<typeof SearchParams>;

export const PAGE_SIZE = 40;
export const CLUSTER_THRESHOLD = 200;

export type ListingSummary = {
  id: string;
  listingType: "sale" | "rent";
  status: string;
  price: number;
  soldPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  propertyType: string;
  listDate: string;
  statusDate: string;
  isFeatured: boolean;
  brokerageName: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  lat: number;
  lng: number;
  coverKey: string | null;
  coverBlur: string | null;
};

export type SearchCluster = { lat: number; lng: number; count: number; minPrice: number; bounds: [number, number, number, number] };
export type SearchPin = { id: string; lat: number; lng: number; price: number };

export type SearchResult = {
  items: ListingSummary[];
  total: number;
  clusters?: SearchCluster[];
  pins?: SearchPin[];
};
