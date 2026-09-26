import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id } from "./columns";
import { properties } from "./listings";

export type ValuationComp = {
  property_id: string;
  sold_price: number;
  sold_at: string;
  distance_m: number;
  adj_price: number;
  weight: number;
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
