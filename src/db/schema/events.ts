import { sql } from "drizzle-orm";
import { bigserial, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./columns";
import { users } from "./users";

// Ingestion runs, moderation queue and analytics events.

export type FeedRunStats = {
  fetched?: number;
  created?: number;
  updated?: number;
  removed?: number;
  media_queued?: number;
  errors?: number;
};

export const feedRuns = pgTable("feed_runs", {
  id: id(),
  source: text("source").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status")
    .$type<"running" | "success" | "partial" | "failed">()
    .notNull()
    .default("running"),
  stats: jsonb("stats").$type<FeedRunStats>().notNull().default({}),
  errorSample: jsonb("error_sample").$type<unknown[]>(),
  cursor: text("cursor"),
});

export const moderationItems = pgTable("moderation_items", {
  id: id(),
  itemType: text("item_type").$type<"listing" | "review" | "pro">().notNull(),
  itemId: uuid("item_id").notNull(),
  reason: text("reason").$type<"new_submission" | "flagged" | "edited">().notNull(),
  status: text("status").notNull().default("open"),
  reviewerUserId: uuid("reviewer_user_id").references(() => users.id),
  decisionNote: text("decision_note"),
  /** Automatic checks that failed (docs/03 section 7); any failure makes the item high priority. */
  failedChecks: jsonb("failed_checks").$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id"),
    anonId: text("anon_id"),
    name: text("name").notNull(),
    props: jsonb("props").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("events_name_time_idx").on(t.name, sql`${t.createdAt} desc`),
    index("events_user_idx").on(t.userId, sql`${t.createdAt} desc`),
  ],
);
