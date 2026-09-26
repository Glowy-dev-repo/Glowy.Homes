import { index, jsonb, pgTable, text, unique, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { geography, id } from "./columns";

export type RegionType = "country" | "province" | "city" | "neighborhood" | "postal_prefix";

export type RegionStats = {
  listing_count?: number;
  median_price?: number;
  median_rent?: number;
  updated_at?: string;
  [key: string]: unknown;
};

// No timestamps: docs/02 defines regions without created_at and updated_at.
export const regions = pgTable(
  "regions",
  {
    id: id(),
    type: text("type").$type<RegionType>().notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => regions.id),
    boundary: geography("boundary", "multipolygon"),
    centroid: geography("centroid", "point"),
    stats: jsonb("stats").$type<RegionStats>().notNull().default({}),
  },
  (t) => [
    unique("regions_type_slug_parent_key").on(t.type, t.slug, t.parentId),
    index("regions_boundary_gix").using("gist", t.boundary),
    index("regions_slug_idx").on(t.slug),
  ],
);
