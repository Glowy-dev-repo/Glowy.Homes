CREATE TABLE "property_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "valuation_accuracy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"listing_id" uuid,
	"city_region_id" uuid,
	"valuation_id" uuid,
	"sold_price" integer NOT NULL,
	"sold_date" date NOT NULL,
	"estimate" integer NOT NULL,
	"abs_pct_error" numeric(7, 4) NOT NULL,
	"method" text DEFAULT 'live' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "property_claims" ADD CONSTRAINT "property_claims_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_claims" ADD CONSTRAINT "property_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_accuracy" ADD CONSTRAINT "valuation_accuracy_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_accuracy" ADD CONSTRAINT "valuation_accuracy_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_accuracy" ADD CONSTRAINT "valuation_accuracy_city_region_id_regions_id_fk" FOREIGN KEY ("city_region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_accuracy" ADD CONSTRAINT "valuation_accuracy_valuation_id_valuations_id_fk" FOREIGN KEY ("valuation_id") REFERENCES "public"."valuations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_claims_user_idx" ON "property_claims" USING btree ("user_id","property_id");--> statement-breakpoint
CREATE INDEX "valuation_accuracy_city_idx" ON "valuation_accuracy" USING btree ("city_region_id","sold_date" desc);--> statement-breakpoint
CREATE INDEX "valuation_accuracy_listing_idx" ON "valuation_accuracy" USING btree ("listing_id");