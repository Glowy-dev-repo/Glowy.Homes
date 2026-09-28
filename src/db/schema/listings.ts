import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, geography, id, tsvector, updatedAt } from "./columns";
import { pros } from "./agents";
import { regions } from "./geo";
import { users } from "./users";

export const PROPERTY_TYPES = ["detached", "semi", "townhouse", "condo", "multi", "land", "other"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const LISTING_STATUSES = [
  "active",
  "pending",
  "sold",
  "leased",
  "expired",
  "withdrawn",
  "draft",
  "in_review",
  "rejected",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export type ListingFeatures = {
  interior?: string[];
  exterior?: string[];
  building?: string[];
  community?: string[];
};

export type RentalTerms = {
  pets?: boolean;
  furnished?: boolean;
  laundry?: string;
  utilities_included?: string[];
  lease_min_months?: number;
  deposit?: number;
  parking?: boolean;
};

// numeric columns come back as strings from the driver; mode "number" keeps them numeric in TS.
const halfSteps = (name: string) => numeric(name, { precision: 3, scale: 1, mode: "number" });

export const properties = pgTable(
  "properties",
  {
    id: id(),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    city: text("city").notNull(),
    regionCode: text("region_code").notNull(),
    postalCode: text("postal_code").notNull(),
    country: text("country").notNull(),
    addressNormalized: text("address_normalized").notNull(),
    location: geography("location", "point").notNull(),
    cityRegionId: uuid("city_region_id").references(() => regions.id),
    neighborhoodRegionId: uuid("neighborhood_region_id").references(() => regions.id),
    propertyType: text("property_type").$type<PropertyType>().notNull(),
    beds: halfSteps("beds"),
    baths: halfSteps("baths"),
    sqft: integer("sqft"),
    lotSqft: integer("lot_sqft"),
    yearBuilt: integer("year_built"),
    stories: integer("stories"),
    parkingSpaces: integer("parking_spaces"),
    facts: jsonb("facts").$type<Record<string, unknown>>().notNull().default({}),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    ownerClaimedAt: timestamp("owner_claimed_at", { withTimezone: true }),
    ownerFactsOverride: jsonb("owner_facts_override").$type<Record<string, unknown>>(),
    lastSoldPrice: integer("last_sold_price"),
    lastSoldAt: date("last_sold_at"),
    source: text("source").notNull().default("feed"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("properties_address_postal_key").on(t.addressNormalized, t.postalCode),
    index("properties_location_gix").using("gist", t.location),
    index("properties_city_idx").on(t.cityRegionId),
    index("properties_addr_trgm").using("gin", t.addressNormalized.op("gin_trgm_ops")),
  ],
);

export const listings = pgTable(
  "listings",
  {
    id: id(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    listingType: text("listing_type").$type<"sale" | "rent">().notNull(),
    status: text("status").$type<ListingStatus>().notNull(),
    source: text("source").notNull(),
    sourceListingId: text("source_listing_id"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    price: integer("price").notNull(),
    priceCurrency: text("price_currency").notNull().default("CAD"),
    originalPrice: integer("original_price"),
    soldPrice: integer("sold_price"),
    listDate: date("list_date").notNull(),
    statusDate: date("status_date").notNull(),
    soldDate: date("sold_date"),
    availableDate: date("available_date"),
    description: text("description"),
    features: jsonb("features").$type<ListingFeatures>().notNull().default({}),
    rentalTerms: jsonb("rental_terms").$type<RentalTerms>(),
    hoaFee: integer("hoa_fee"),
    taxAnnual: integer("tax_annual"),
    virtualTourUrl: text("virtual_tour_url"),
    listingAgentId: uuid("listing_agent_id").references(() => pros.id),
    /** User listings: how the owner wants to be contacted (docs/05 Phase 5 task 1). */
    contactPrefs: jsonb("contact_prefs").$type<{ showPhone?: boolean; phone?: string | null; preferred?: "email" | "phone" }>(),
    /** Listing office (MLS ListOfficeName); shown as "Listed by [agent] of [brokerage]" (CSMAR Rule 12.16.5). */
    brokerageName: text("brokerage_name"),
    listAgentName: text("list_agent_name"),
    listAgentPhone: text("list_agent_phone"),
    listAgentEmail: text("list_agent_email"),
    listOfficePhone: text("list_office_phone"),
    coListAgentName: text("co_list_agent_name"),
    coListOfficeName: text("co_list_office_name"),
    /** Seller choices carried by the MLS (CSMAR Rules 12.16.11 and 12.16.15). */
    internetDisplay: boolean("internet_display").notNull().default(true),
    addressDisplay: boolean("address_display").notNull().default(true),
    hideEstimate: boolean("hide_estimate").notNull().default(false),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    isFeatured: boolean("is_featured").notNull().default(false),
    featuredUntil: timestamp("featured_until", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    saveCount: integer("save_count").notNull().default(0),
    searchVector: tsvector("search_vector"),
    // Denormalized from properties for fast search; kept in sync by trigger.
    location: geography("location", "point").notNull(),
    propertyType: text("property_type").$type<PropertyType>().notNull(),
    beds: halfSteps("beds"),
    baths: halfSteps("baths"),
    sqft: integer("sqft"),
    cityRegionId: uuid("city_region_id"),
    neighborhoodRegionId: uuid("neighborhood_region_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("listings_source_listing_key").on(t.source, t.sourceListingId),
    index("listings_search_main").on(t.listingType, t.status, t.price),
    index("listings_location_gix").using("gist", t.location),
    index("listings_city_idx").on(t.cityRegionId, t.listingType, t.status),
    index("listings_fts").using("gin", t.searchVector),
    index("listings_list_date_idx").on(sql`${t.listDate} desc`),
    // Beyond docs/02: neighborhood browse pages, incremental ingest lookups, property history.
    index("listings_neighborhood_idx").on(t.neighborhoodRegionId, t.listingType, t.status),
    index("listings_property_idx").on(t.propertyId),
    // Saved search alerts look for listings created since the last send.
    index("listings_created_idx").on(t.createdAt),
    // Valuation comps: nearest closed sales and leases only, so KNN scans far fewer rows.
    index("listings_closed_gix")
      .using("gist", t.location)
      .where(sql`${t.status} in ('sold', 'leased')`),
  ],
);

export const PRICE_EVENT_TYPES = [
  "listed",
  "price_change",
  "pending",
  "sold",
  "leased",
  "relisted",
  "withdrawn",
  "expired",
] as const;

export const listingPriceEvents = pgTable(
  "listing_price_events",
  {
    id: id(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    listingId: uuid("listing_id").references(() => listings.id),
    eventType: text("event_type").$type<(typeof PRICE_EVENT_TYPES)[number]>().notNull(),
    price: integer("price"),
    eventDate: date("event_date").notNull(),
    source: text("source").notNull(),
  },
  (t) => [index("lpe_property_idx").on(t.propertyId, sql`${t.eventDate} desc`)],
);
