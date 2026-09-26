import { z } from "zod";
import { PROPERTY_TYPES } from "@/db/schema/listings";

// docs/02 section 4. Every search page, saved search and alert uses this one schema.

export const LISTING_SEARCH_STATUSES = ["active", "pending", "sold", "leased"] as const;
export const SORTS = ["newest", "price_asc", "price_desc", "sqft_desc", "ppsf_asc"] as const;

export const SearchParams = z.object({
  type: z.enum(["sale", "rent"]).default("sale"),
  status: z.array(z.enum(LISTING_SEARCH_STATUSES)).min(1).default(["active"]),
  q: z.string().trim().max(200).optional(),
  city: z.string().max(80).optional(),
  neighborhood: z.string().max(80).optional(),
  bounds: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90), z.number().min(-180).max(180), z.number().min(-90).max(90)]).optional(),
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3).max(200).optional(),
  priceMin: z.number().int().nonnegative().optional(),
  priceMax: z.number().int().positive().optional(),
  bedsMin: z.number().min(0).max(10).optional(),
  bathsMin: z.number().min(0).max(10).optional(),
  propertyTypes: z.array(z.enum(PROPERTY_TYPES)).optional(),
  sqftMin: z.number().int().optional(),
  sqftMax: z.number().int().optional(),
  yearBuiltMin: z.number().int().optional(),
  daysOnMarketMax: z.number().int().optional(),
  keywords: z.string().trim().max(200).optional(),
  // rental only
  pets: z.boolean().optional(),
  furnished: z.boolean().optional(),
  /** In suite laundry (rentals). */
  laundry: z.boolean().optional(),
  parking: z.boolean().optional(),
  availableBy: z.string().date().optional(),
  sort: z.enum(SORTS).default("newest"),
  page: z.number().int().min(1).default(1),
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
