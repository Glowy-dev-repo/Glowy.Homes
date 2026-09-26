CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"phone" text,
	"image_url" text,
	"email_verified_at" timestamp with time zone,
	"roles" text[] DEFAULT '{consumer}' NOT NULL,
	"notification_prefs" jsonb DEFAULT '{"saved_search":"daily","marketing":false}'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"parent_id" uuid,
	"boundary" geography(multipolygon, 4326),
	"centroid" geography(point, 4326),
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "regions_type_slug_parent_key" UNIQUE("type","slug","parent_id")
);
--> statement-breakpoint
CREATE TABLE "listing_price_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"listing_id" uuid,
	"event_type" text NOT NULL,
	"price" integer,
	"event_date" date NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"listing_type" text NOT NULL,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"source_listing_id" text,
	"source_updated_at" timestamp with time zone,
	"price" integer NOT NULL,
	"price_currency" text DEFAULT 'CAD' NOT NULL,
	"original_price" integer,
	"sold_price" integer,
	"list_date" date NOT NULL,
	"status_date" date NOT NULL,
	"sold_date" date,
	"available_date" date,
	"description" text,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rental_terms" jsonb,
	"hoa_fee" integer,
	"tax_annual" integer,
	"virtual_tour_url" text,
	"listing_agent_id" uuid,
	"brokerage_name" text,
	"owner_user_id" uuid,
	"is_featured" boolean DEFAULT false NOT NULL,
	"featured_until" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"save_count" integer DEFAULT 0 NOT NULL,
	"search_vector" "tsvector",
	"location" geography(point, 4326) NOT NULL,
	"property_type" text NOT NULL,
	"beds" numeric(3, 1),
	"baths" numeric(3, 1),
	"sqft" integer,
	"city_region_id" uuid,
	"neighborhood_region_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "listings_source_listing_key" UNIQUE("source","source_listing_id")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"region_code" text NOT NULL,
	"postal_code" text NOT NULL,
	"country" text NOT NULL,
	"address_normalized" text NOT NULL,
	"location" geography(point, 4326) NOT NULL,
	"city_region_id" uuid,
	"neighborhood_region_id" uuid,
	"property_type" text NOT NULL,
	"beds" numeric(3, 1),
	"baths" numeric(3, 1),
	"sqft" integer,
	"lot_sqft" integer,
	"year_built" integer,
	"stories" integer,
	"parking_spaces" integer,
	"facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"owner_user_id" uuid,
	"owner_claimed_at" timestamp with time zone,
	"owner_facts_override" jsonb,
	"last_sold_price" integer,
	"last_sold_at" date,
	"source" text DEFAULT 'feed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "properties_address_postal_key" UNIQUE("address_normalized","postal_code")
);
--> statement-breakpoint
CREATE TABLE "listing_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"kind" text DEFAULT 'photo' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"source_url" text,
	"storage_key" text,
	"width" integer,
	"height" integer,
	"blur_data_url" text,
	"caption" text,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "valuations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"low" integer NOT NULL,
	"high" integer NOT NULL,
	"confidence" text NOT NULL,
	"model_version" text NOT NULL,
	"comps" jsonb NOT NULL,
	"inputs" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pro_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pro_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"lead_id" uuid,
	"rating" integer NOT NULL,
	"body" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "pro_reviews_rating_check" CHECK ("pro_reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "pro_service_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pro_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"share_percent" integer DEFAULT 100 NOT NULL,
	"active_until" timestamp with time zone,
	CONSTRAINT "pro_service_areas_pro_region_key" UNIQUE("pro_id","region_id")
);
--> statement-breakpoint
CREATE TABLE "pros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pro_type" text NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"brokerage_name" text,
	"license_number" text,
	"license_region" text,
	"license_verified_at" timestamp with time zone,
	"phone" text,
	"bio" text,
	"photo_url" text,
	"languages" text[] DEFAULT '{en}',
	"specialties" text[] DEFAULT '{}',
	"years_experience" integer,
	"rating" numeric(2, 1),
	"review_count" integer DEFAULT 0 NOT NULL,
	"response_time_minutes" integer,
	"lead_cap_per_day" integer DEFAULT 10 NOT NULL,
	"is_accepting_leads" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "pros_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "pros_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "lead_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_type" text NOT NULL,
	"consumer_user_id" uuid,
	"consumer_name" text NOT NULL,
	"consumer_email" text NOT NULL,
	"consumer_phone" text,
	"listing_id" uuid,
	"property_id" uuid,
	"region_id" uuid,
	"message" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assigned_pro_id" uuid,
	"assigned_at" timestamp with time zone,
	"routing_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now(),
	"first_response_at" timestamp with time zone,
	"score" integer DEFAULT 0 NOT NULL,
	"source_page" text,
	"utm" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recently_viewed" (
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "recently_viewed_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "saved_homes" (
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "saved_homes_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"boundary" geography(polygon, 4326),
	"alert_frequency" text DEFAULT 'daily' NOT NULL,
	"last_alert_at" timestamp with time zone,
	"last_seen_listing_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rental_application_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"lead_id" uuid,
	"status" text DEFAULT 'submitted' NOT NULL,
	"landlord_notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "rental_app_submissions_app_listing_key" UNIQUE("application_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "rental_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"applicant_user_id" uuid NOT NULL,
	"profile" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"anon_id" text,
	"name" text NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feed_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_sample" jsonb,
	"cursor" text
);
--> statement-breakpoint
CREATE TABLE "moderation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_type" text NOT NULL,
	"item_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reviewer_user_id" uuid,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_parent_id_regions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_price_events" ADD CONSTRAINT "listing_price_events_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_price_events" ADD CONSTRAINT "listing_price_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_listing_agent_id_pros_id_fk" FOREIGN KEY ("listing_agent_id") REFERENCES "public"."pros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_city_region_id_regions_id_fk" FOREIGN KEY ("city_region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_neighborhood_region_id_regions_id_fk" FOREIGN KEY ("neighborhood_region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pro_reviews" ADD CONSTRAINT "pro_reviews_pro_id_pros_id_fk" FOREIGN KEY ("pro_id") REFERENCES "public"."pros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pro_reviews" ADD CONSTRAINT "pro_reviews_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pro_reviews" ADD CONSTRAINT "pro_reviews_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pro_service_areas" ADD CONSTRAINT "pro_service_areas_pro_id_pros_id_fk" FOREIGN KEY ("pro_id") REFERENCES "public"."pros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pro_service_areas" ADD CONSTRAINT "pro_service_areas_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pros" ADD CONSTRAINT "pros_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_messages" ADD CONSTRAINT "lead_messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_messages" ADD CONSTRAINT "lead_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_consumer_user_id_users_id_fk" FOREIGN KEY ("consumer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_pro_id_pros_id_fk" FOREIGN KEY ("assigned_pro_id") REFERENCES "public"."pros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_homes" ADD CONSTRAINT "saved_homes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_homes" ADD CONSTRAINT "saved_homes_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_application_submissions" ADD CONSTRAINT "rental_application_submissions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_application_submissions" ADD CONSTRAINT "rental_application_submissions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_application_submissions" ADD CONSTRAINT "rental_app_submissions_application_fk" FOREIGN KEY ("application_id") REFERENCES "public"."rental_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_applications" ADD CONSTRAINT "rental_applications_applicant_user_id_users_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_items" ADD CONSTRAINT "moderation_items_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "regions_boundary_gix" ON "regions" USING gist ("boundary");--> statement-breakpoint
CREATE INDEX "regions_slug_idx" ON "regions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "lpe_property_idx" ON "listing_price_events" USING btree ("property_id","event_date" desc);--> statement-breakpoint
CREATE INDEX "listings_search_main" ON "listings" USING btree ("listing_type","status","price");--> statement-breakpoint
CREATE INDEX "listings_location_gix" ON "listings" USING gist ("location");--> statement-breakpoint
CREATE INDEX "listings_city_idx" ON "listings" USING btree ("city_region_id","listing_type","status");--> statement-breakpoint
CREATE INDEX "listings_fts" ON "listings" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "listings_list_date_idx" ON "listings" USING btree ("list_date" desc);--> statement-breakpoint
CREATE INDEX "properties_location_gix" ON "properties" USING gist ("location");--> statement-breakpoint
CREATE INDEX "properties_city_idx" ON "properties" USING btree ("city_region_id");--> statement-breakpoint
CREATE INDEX "properties_addr_trgm" ON "properties" USING gin ("address_normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "listing_media_listing_idx" ON "listing_media" USING btree ("listing_id","position");--> statement-breakpoint
CREATE INDEX "valuations_property_idx" ON "valuations" USING btree ("property_id","kind","computed_at" desc);--> statement-breakpoint
CREATE INDEX "psa_region_idx" ON "pro_service_areas" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "leads_pro_idx" ON "leads" USING btree ("assigned_pro_id","status","created_at" desc);--> statement-breakpoint
CREATE INDEX "leads_consumer_idx" ON "leads" USING btree ("consumer_user_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "saved_searches_alert_idx" ON "saved_searches" USING btree ("alert_frequency","last_alert_at");--> statement-breakpoint
CREATE INDEX "events_name_time_idx" ON "events" USING btree ("name","created_at" desc);--> statement-breakpoint
CREATE INDEX "events_user_idx" ON "events" USING btree ("user_id","created_at" desc);