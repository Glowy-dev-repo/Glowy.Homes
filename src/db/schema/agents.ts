import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./columns";
import { regions } from "./geo";
import { leads } from "./leads";
import { users } from "./users";

export const PRO_TYPES = ["agent", "lender", "landlord", "property_manager"] as const;
export type ProType = (typeof PRO_TYPES)[number];

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
  isAcceptingLeads: boolean("is_accepting_leads").notNull().default(true),
  status: text("status").$type<"pending" | "active" | "suspended">().notNull().default("pending"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

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
