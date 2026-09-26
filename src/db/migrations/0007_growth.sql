CREATE TABLE "alert_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"saved_search_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"listing_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "alert_sends_window_key" UNIQUE("saved_search_id","period_key")
);
--> statement-breakpoint
CREATE TABLE "saved_home_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"invitee_email" text NOT NULL,
	"invitee_user_id" uuid,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"accepted_at" timestamp with time zone,
	CONSTRAINT "saved_home_shares_owner_email_key" UNIQUE("owner_user_id","invitee_email")
);
--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN "summary_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alert_sends" ADD CONSTRAINT "alert_sends_saved_search_id_saved_searches_id_fk" FOREIGN KEY ("saved_search_id") REFERENCES "public"."saved_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_home_shares" ADD CONSTRAINT "saved_home_shares_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_home_shares" ADD CONSTRAINT "saved_home_shares_invitee_user_id_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_home_shares_invitee_idx" ON "saved_home_shares" USING btree ("invitee_user_id");