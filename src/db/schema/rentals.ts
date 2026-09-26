import { foreignKey, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./columns";
import { leads } from "./leads";
import { listings } from "./listings";
import { users } from "./users";

export const rentalApplications = pgTable("rental_applications", {
  id: id(),
  applicantUserId: uuid("applicant_user_id")
    .notNull()
    .references(() => users.id),
  // Employment, income, references, pets, occupants. Reused across listings.
  profile: jsonb("profile").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("draft"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const rentalApplicationSubmissions = pgTable(
  "rental_application_submissions",
  {
    id: id(),
    applicationId: uuid("application_id").notNull(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    leadId: uuid("lead_id").references(() => leads.id),
    status: text("status")
      .$type<"submitted" | "reviewing" | "approved" | "declined" | "withdrawn">()
      .notNull()
      .default("submitted"),
    landlordNotes: text("landlord_notes"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("rental_app_submissions_app_listing_key").on(t.applicationId, t.listingId),
    // Explicit name: the generated one exceeds Postgres's 63 character identifier limit.
    foreignKey({
      name: "rental_app_submissions_application_fk",
      columns: [t.applicationId],
      foreignColumns: [rentalApplications.id],
    }),
  ],
);
