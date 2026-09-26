import { sql } from "drizzle-orm";
import { index, integer, jsonb, numeric, pgTable, date, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./columns";
import { regions } from "./geo";
import { listings, properties } from "./listings";
import { users } from "./users";

export type ValuationComp = {
  property_id: string;
  sold_price: number;
  sold_at: string;
  distance_m: number;
  adj_price: number;
  weight: number;
  address?: string;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
};

export const valuations = pgTable(
  "valuations",
  {
    id: id(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    kind: text("kind").$type<"value" | "rent">().notNull(),
    amount: integer("amount").notNull(),
    low: integer("low").notNull(),
    high: integer("high").notNull(),
    confidence: text("confidence").$type<"low" | "medium" | "high">().notNull(),
    modelVersion: text("model_version").notNull(),
    comps: jsonb("comps").$type<ValuationComp[]>().notNull(),
    inputs: jsonb("inputs").$type<Record<string, unknown>>().notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("valuations_property_idx").on(t.propertyId, t.kind, sql`${t.computedAt} desc`)],
);

// Phase 3 (docs/03 section 3.4): how far the estimate that existed 30 days before a sale was from
// the sale price. Filled nightly by score_valuations, and by a backtest when seeding.
export const valuationAccuracy = pgTable(
  "valuation_accuracy",
  {
    id: id(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    listingId: uuid("listing_id").references(() => listings.id),
    cityRegionId: uuid("city_region_id").references(() => regions.id),
    valuationId: uuid("valuation_id").references(() => valuations.id),
    soldPrice: integer("sold_price").notNull(),
    soldDate: date("sold_date").notNull(),
    estimate: integer("estimate").notNull(),
    absPctError: numeric("abs_pct_error", { precision: 7, scale: 4, mode: "number" }).notNull(),
    method: text("method").$type<"live" | "backtest">().notNull().default("live"),
    createdAt: createdAt(),
  },
  (t) => [
    index("valuation_accuracy_city_idx").on(t.cityRegionId, sql`${t.soldDate} desc`),
    index("valuation_accuracy_listing_idx").on(t.listingId),
  ],
);

// Ownership verification codes (docs/05 Phase 3 task 6). The code is stored hashed.
export const propertyClaims = pgTable(
  "property_claims",
  {
    id: id(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("property_claims_user_idx").on(t.userId, t.propertyId)],
);
