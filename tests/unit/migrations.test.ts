import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { unquotePostgisTypes } from "../../scripts/lib/migrations";

describe("migrations", () => {
  it("unquotes PostGIS types only", () => {
    expect(unquotePostgisTypes(`"location" "geography(point, 4326)" NOT NULL, "v" "tsvector"`)).toBe(
      `"location" geography(point, 4326) NOT NULL, "v" "tsvector"`,
    );
  });

  it("committed migrations contain no quoted PostGIS types", () => {
    const dir = "src/db/migrations";
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql"))) {
      expect(readFileSync(`${dir}/${f}`, "utf8"), f).not.toMatch(/"geography\(|"geometry\(/);
    }
  });

  it("migration 0001 creates every Phase 0 table and skips Phase 3 and 5 tables", () => {
    const sql = readFileSync("src/db/migrations/0001_core_schema.sql", "utf8");
    const tables = [...sql.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((m) => m[1]);
    for (const t of ["users", "regions", "properties", "listings", "listing_media", "listing_price_events", "valuations", "pros", "pro_service_areas", "pro_reviews", "leads", "lead_messages", "saved_homes", "saved_searches", "recently_viewed", "rental_applications", "rental_application_submissions", "feed_runs", "moderation_items", "events", "accounts", "sessions", "verification_tokens"]) {
      expect(tables, t).toContain(t);
    }
    expect(tables).not.toContain("subscriptions");
    expect(tables).not.toContain("valuation_accuracy");
  });
});
