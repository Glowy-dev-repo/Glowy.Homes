import { z } from "zod";
import { PROPERTY_TYPES } from "@/db/schema/listings";

export type FeedSource = "synthetic" | "reso" | "crea_ddf" | "csv";

/** A record exactly as a feed returns it. Each adapter knows its own shape. */
export type RawListing = Record<string, unknown>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const NormalizedListingSchema = z.object({
  sourceListingId: z.string().min(1),
  sourceUpdatedAt: z.string().datetime({ offset: true }),
  listingType: z.enum(["sale", "rent"]),
  status: z.enum(["active", "pending", "sold", "leased", "expired", "withdrawn"]),
  price: z.number().int().positive(),
  originalPrice: z.number().int().positive().optional(),
  soldPrice: z.number().int().positive().optional(),
  listDate: isoDate,
  statusDate: isoDate,
  soldDate: isoDate.optional(),
  availableDate: isoDate.optional(),
  address: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    regionCode: z.string().min(2),
    postalCode: z.string().min(3),
    country: z.string().length(2),
  }),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  propertyType: z.enum(PROPERTY_TYPES),
  beds: z.number().min(0).max(20).optional(),
  baths: z.number().min(0).max(20).optional(),
  sqft: z.number().int().positive().optional(),
  lotSqft: z.number().int().positive().optional(),
  yearBuilt: z.number().int().min(1800).max(2100).optional(),
  stories: z.number().int().positive().optional(),
  parkingSpaces: z.number().int().min(0).optional(),
  facts: z.record(z.string(), z.unknown()),
  features: z.object({
    interior: z.array(z.string()),
    exterior: z.array(z.string()),
    building: z.array(z.string()),
    community: z.array(z.string()),
  }),
  rentalTerms: z
    .object({
      pets: z.boolean().optional(),
      furnished: z.boolean().optional(),
      laundry: z.string().optional(),
      parking: z.boolean().optional(),
      utilities_included: z.array(z.string()).optional(),
      lease_min_months: z.number().int().optional(),
      deposit: z.number().int().optional(),
    })
    .optional(),
  description: z.string().optional(),
  hoaFee: z.number().int().min(0).optional(),
  taxAnnual: z.number().int().min(0).optional(),
  // Web links only: a feed must not be able to put a javascript: link on a listing page.
  virtualTourUrl: z.string().url().refine((u) => /^https?:\/\//i.test(u), "Use an http or https link").optional(),
  media: z.array(
    z.object({
      url: z.string().min(1),
      kind: z.enum(["photo", "floorplan", "video"]),
      position: z.number().int().min(0),
      caption: z.string().optional(),
    }),
  ),
  agent: z
    .object({
      name: z.string(),
      email: z.string().optional(),
      phone: z.string().optional(),
      licenseNumber: z.string().optional(),
      brokerage: z.string(),
      /** Listing office phone (MLS ListOfficePhone). */
      officePhone: z.string().optional(),
      coAgentName: z.string().optional(),
      coBrokerage: z.string().optional(),
    })
    .optional(),
  /** Seller display choices from the MLS (RESO InternetEntireListingDisplayYN, InternetAddressDisplayYN). */
  display: z.object({ internet: z.boolean().optional(), address: z.boolean().optional() }).optional(),
  /**
   * Past events for this listing when the feed provides them (RESO history resources do).
   * Used only when the listing is first created; later changes are detected by diffing.
   */
  history: z
    .array(
      z.object({
        eventType: z.enum(["listed", "price_change", "pending", "sold", "leased", "relisted", "withdrawn", "expired"]),
        price: z.number().int().positive().optional(),
        date: isoDate,
      }),
    )
    .optional(),
});

export type NormalizedListing = z.infer<typeof NormalizedListingSchema>;

export interface ListingFeedAdapter {
  source: FeedSource;
  /** Listings changed since cursor, in pages. Never loads everything in memory. */
  fetchChanged(cursor: string | null, pageSize: number): AsyncGenerator<{ items: RawListing[]; nextCursor: string | null }>;
  /** Maps a raw record to the normalized shape. Pure. */
  normalize(raw: RawListing): NormalizedListing;
}
