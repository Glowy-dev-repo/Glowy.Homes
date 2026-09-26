CREATE INDEX "regions_type_idx" ON "regions" USING btree ("type","parent_id");--> statement-breakpoint
CREATE INDEX "listings_neighborhood_idx" ON "listings" USING btree ("neighborhood_region_id","listing_type","status");--> statement-breakpoint
CREATE INDEX "listings_property_idx" ON "listings" USING btree ("property_id");