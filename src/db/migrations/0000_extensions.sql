-- Extensions required by the schema: PostGIS for geography columns and spatial indexes,
-- pg_trgm for fuzzy address matching. gen_random_uuid() is built into Postgres 13+.
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
