import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./columns";
import { pros } from "./agents";
import { regions } from "./geo";
import { listings, properties } from "./listings";
import { users } from "./users";

export const LEAD_TYPES = [
  "tour",
  "contact",
  "sell",
  "preapproval",
  "rental_inquiry",
  "rental_application",
] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "touring",
  "under_contract",
  "closed",
  "lost",
  "unassigned",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type RoutingLogEntry = {
  at: string;
  action: string;
  reason: string;
  pro_id?: string;
  candidates?: string[];
  [key: string]: unknown;
};

export const leads = pgTable(
  "leads",
  {
    id: id(),
    leadType: text("lead_type").$type<LeadType>().notNull(),
    consumerUserId: uuid("consumer_user_id").references(() => users.id),
    consumerName: text("consumer_name").notNull(),
    consumerEmail: text("consumer_email").notNull(),
    consumerPhone: text("consumer_phone"),
    listingId: uuid("listing_id").references(() => listings.id),
    propertyId: uuid("property_id").references(() => properties.id),
    regionId: uuid("region_id").references(() => regions.id),
    message: text("message"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    assignedProId: uuid("assigned_pro_id").references(() => pros.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    routingLog: jsonb("routing_log").$type<RoutingLogEntry[]>().notNull().default([]),
    status: text("status").$type<LeadStatus>().notNull().default("new"),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).defaultNow(),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    score: integer("score").notNull().default(0),
    sourcePage: text("source_page"),
    utm: jsonb("utm").$type<Record<string, string>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("leads_pro_idx").on(t.assignedProId, t.status, sql`${t.createdAt} desc`),
    index("leads_consumer_idx").on(t.consumerUserId, sql`${t.createdAt} desc`),
  ],
);

export const leadMessages = pgTable("lead_messages", {
  id: id(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  senderUserId: uuid("sender_user_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
});
