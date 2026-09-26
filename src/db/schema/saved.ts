import { index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, geography, id } from "./columns";
import { listings } from "./listings";
import { users } from "./users";

// Consumer saved state: saved homes, saved searches, recently viewed.

export const savedHomes = pgTable(
  "saved_homes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Same shape as the SearchParams zod schema in src/types.
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull(),
    boundary: geography("boundary", "polygon"),
    alertFrequency: text("alert_frequency")
      .$type<"instant" | "daily" | "weekly" | "off">()
      .notNull()
      .default("daily"),
    lastAlertAt: timestamp("last_alert_at", { withTimezone: true }),
    lastSeenListingAt: timestamp("last_seen_listing_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("saved_searches_alert_idx").on(t.alertFrequency, t.lastAlertAt)],
);

export const recentlyViewed = pgTable(
  "recently_viewed",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);
