ALTER TABLE "listings" ADD COLUMN "published_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "rental_application_submissions" ADD COLUMN "profile_snapshot" jsonb;--> statement-breakpoint
-- Existing listings: visible ones were published when they were created; ones still waiting were not published yet.
UPDATE "listings" SET "published_at" = CASE WHEN "status" IN ('draft', 'in_review', 'rejected') THEN NULL ELSE "created_at" END;--> statement-breakpoint
UPDATE "rental_application_submissions" s SET "profile_snapshot" = a."profile" FROM "rental_applications" a WHERE a."id" = s."application_id" AND s."profile_snapshot" IS NULL;
