CREATE TABLE "pro_zip_codes" (
	"pro_id" uuid NOT NULL,
	"zip" text NOT NULL,
	"active_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "pro_zip_codes_pro_zip_key" UNIQUE("pro_id","zip")
);
--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "list_agent_name" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "list_agent_phone" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "list_agent_email" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "list_office_phone" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "co_list_agent_name" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "co_list_office_name" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "internet_display" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "address_display" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "hide_estimate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pros" ADD COLUMN "price_min" integer;--> statement-breakpoint
ALTER TABLE "pros" ADD COLUMN "price_max" integer;--> statement-breakpoint
ALTER TABLE "pro_zip_codes" ADD CONSTRAINT "pro_zip_codes_pro_id_pros_id_fk" FOREIGN KEY ("pro_id") REFERENCES "public"."pros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pro_zip_codes_zip_idx" ON "pro_zip_codes" USING btree ("zip");