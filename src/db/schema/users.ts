import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./columns";

export type NotificationPrefs = {
  saved_search: "instant" | "daily" | "weekly" | "off";
  marketing: boolean;
};

export const ROLES = ["consumer", "agent", "lender", "landlord", "admin"] as const;
export type Role = (typeof ROLES)[number];

// JS keys emailVerified and image match what the Auth.js Drizzle adapter expects;
// the database columns keep the names from docs/02.
export const users = pgTable("users", {
  id: id(),
  email: text("email").unique().notNull(),
  name: text("name"),
  phone: text("phone"),
  image: text("image_url"),
  emailVerified: timestamp("email_verified_at", { withTimezone: true, mode: "date" }),
  roles: text("roles").array().$type<Role[]>().notNull().default(sql`'{consumer}'`),
  notificationPrefs: jsonb("notification_prefs")
    .$type<NotificationPrefs>()
    .notNull()
    .default({ saved_search: "daily", marketing: false }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Auth.js standard tables, shaped for @auth/drizzle-adapter.
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
