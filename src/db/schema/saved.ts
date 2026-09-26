import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
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

/**
 * One row per alert email actually sent. The unique key is the frequency window (for example
 * daily:2026-09-26), so a saved search can never get two emails in the same window (docs/03 section 6).
 */
export const alertSends = pgTable(
  "alert_sends",
  {
    id: id(),
    savedSearchId: uuid("saved_search_id")
      .notNull()
      .references(() => savedSearches.id, { onDelete: "cascade" }),
    periodKey: text("period_key").notNull(),
    listingCount: integer("listing_count").notNull(),
    sentAt: createdAt(),
  },
  (t) => [unique("alert_sends_window_key").on(t.savedSearchId, t.periodKey)],
);

/** A saved homes list shared with a cobuyer, invited by email (docs/05 Phase 6 task 4). */
export const savedHomeShares = pgTable(
  "saved_home_shares",
  {
    id: id(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteeEmail: text("invitee_email").notNull(),
    inviteeUserId: uuid("invitee_user_id").references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: createdAt(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [unique("saved_home_shares_owner_email_key").on(t.ownerUserId, t.inviteeEmail), index("saved_home_shares_invitee_idx").on(t.inviteeUserId)],
);
