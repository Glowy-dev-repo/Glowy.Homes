import { sql } from "drizzle-orm";
import { customType, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * PostGIS geography column. Values cross the driver as text (WKT on write, EWKB hex on read);
 * query code converts with ST_ functions in SQL rather than parsing here.
 */
export const geography = (name: string, shape: "point" | "polygon" | "multipolygon") =>
  customType<{ data: string; driverData: string }>({
    dataType: () => `geography(${shape}, 4326)`,
  })(name);

export const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
export const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow();
export const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow();
