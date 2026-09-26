ALTER TABLE "listings" ADD COLUMN "contact_prefs" jsonb;--> statement-breakpoint
ALTER TABLE "moderation_items" ADD COLUMN "failed_checks" jsonb DEFAULT '[]'::jsonb NOT NULL;