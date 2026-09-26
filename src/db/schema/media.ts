import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id } from "./columns";
import { listings } from "./listings";

export const listingMedia = pgTable(
  "listing_media",
  {
    id: id(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"photo" | "floorplan" | "video">().notNull().default("photo"),
    position: integer("position").notNull().default(0),
    sourceUrl: text("source_url"),
    storageKey: text("storage_key"),
    width: integer("width"),
    height: integer("height"),
    blurDataUrl: text("blur_data_url"),
    caption: text("caption"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [index("listing_media_listing_idx").on(t.listingId, t.position)],
);
