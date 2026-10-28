import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./columns";
import { regions } from "./geo";
import { leads } from "./leads";
import { users } from "./users";

// "owner" is a for sale by owner seller: a profile only so inquiries on their listing reach them.
export const PRO_TYPES = ["agent", "lender", "landlord", "property_manager", "owner"] as const;
export type ProType = (typeof PRO_TYPES)[number];
export type ProStatus = "pending" | "active" | "suspended";
export type ProStatusLogEntry = { at: string; from: ProStatus; to: ProStatus; action: string; reason: string | null; admin_user_id: string | null };

export const pros = pgTable("pros", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  proType: text("pro_type").$type<ProType>().notNull(),
  slug: text("slug").unique().notNull(),
  displayName: text("display_name").notNull(),
  brokerageName: text("brokerage_name"),
  licenseNumber: text("license_number"),
  licenseRegion: text("license_region"),
  licenseVerifiedAt: timestamp("license_verified_at", { withTimezone: true }),
  phone: text("phone"),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  languages: text("languages").array().default(sql`'{en}'`),
  specialties: text("specialties").array().default(sql`'{}'`),
  yearsExperience: integer("years_experience"),
  rating: numeric("rating", { precision: 2, scale: 1, mode: "number" }),
  reviewCount: integer("review_count").notNull().default(0),
  responseTimeMinutes: integer("response_time_minutes"),
  leadCapPerDay: integer("lead_cap_per_day").notNull().default(10),
  /** Price range the agent works in; leads inside it rank higher (lead routing by ZIP code). */
  priceMin: integer("price_min"),
  priceMax: integer("price_max"),
  isAcceptingLeads: boolean("is_accepting_leads").notNull().default(true),
  status: text("status").$type<ProStatus>().notNull().default("pending"),
  /** Partner agreement the agent accepted at signup (lib/pros/license.ts PARTNER_AGREEMENT_VERSION). */
  agreementVersion: text("agreement_version"),
  agreementAcceptedAt: timestamp("agreement_accepted_at", { withTimezone: true }),
  /** Every status change by an admin: who, when, from, to and why (lib/pros/status.ts). */
  statusLog: jsonb("status_log").$type<ProStatusLogEntry[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  // One working account per DRE license: suspended duplicates stay for the record.
  uniqueIndex("pros_agent_license_key")
    .on(t.licenseRegion, t.licenseNumber)
    .where(sql`${t.proType} = 'agent' and ${t.status} <> 'suspended' and ${t.licenseNumber} is not null`),
]);

/** Agents Glowy Homes invited by email. An invite grants nothing: the agent still signs up and is approved. */
export const proInvites = pgTable(
  "pro_invites",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name"),
    invitedBy: uuid("invited_by").references(() => users.id),
    createdAt: createdAt(),
    acceptedProId: uuid("accepted_pro_id").references(() => pros.id),
  },
  (t) => [uniqueIndex("pro_invites_email_key").on(sql`lower(${t.email})`)],
);

export const proServiceAreas = pgTable(
  "pro_service_areas",
  {
    id: id(),
    proId: uuid("pro_id")
      .notNull()
      .references(() => pros.id, { onDelete: "cascade" }),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    sharePercent: integer("share_percent").notNull().default(100),
    activeUntil: timestamp("active_until", { withTimezone: true }),
  },
  (t) => [
    unique("pro_service_areas_pro_region_key").on(t.proId, t.regionId),
    index("psa_region_idx").on(t.regionId),
  ],
);

/** ZIP codes an agent receives leads for: a lead goes to an agent covering the home's ZIP code. */
export const proZipCodes = pgTable(
  "pro_zip_codes",
  {
    proId: uuid("pro_id")
      .notNull()
      .references(() => pros.id, { onDelete: "cascade" }),
    zip: text("zip").notNull(),
    activeUntil: timestamp("active_until", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique("pro_zip_codes_pro_zip_key").on(t.proId, t.zip), index("pro_zip_codes_zip_idx").on(t.zip)],
);

export const proReviews = pgTable(
  "pro_reviews",
  {
    id: id(),
    proId: uuid("pro_id")
      .notNull()
      .references(() => pros.id),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id),
    leadId: uuid("lead_id").references(() => leads.id),
    rating: integer("rating").notNull(),
    body: text("body"),
    status: text("status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [check("pro_reviews_rating_check", sql`${t.rating} between 1 and 5`)],
);
