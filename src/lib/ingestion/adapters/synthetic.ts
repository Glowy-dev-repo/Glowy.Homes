import { createReadStream, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { syntheticBlurDataUrl, syntheticStorageKey } from "@/lib/media/synthetic";
import { NormalizedListingSchema, type ListingFeedAdapter, type NormalizedListing, type RawListing } from "../types";

export const SYNTHETIC_FEED_PATH = resolve(process.cwd(), "scripts/data/generated/synthetic_feed.jsonl");

/**
 * Reads the JSONL file written by scripts/seed.ts, so the synthetic feed runs through exactly the
 * same ingestion path as a licensed feed. Records are ordered by sourceUpdatedAt; the cursor is the
 * last sourceUpdatedAt delivered.
 */
export function syntheticAdapter(path = SYNTHETIC_FEED_PATH): ListingFeedAdapter & {
  inlineMedia(url: string): { storageKey: string; blurDataUrl: string; width: number; height: number } | null;
} {
  return {
    source: "synthetic",

    async *fetchChanged(cursor, pageSize) {
      if (!existsSync(path)) throw new Error(`Synthetic feed not found at ${path}. Run npm run db:seed.`);
      const lines = createInterface({ input: createReadStream(path, "utf8"), crlfDelay: Infinity });
      let page: RawListing[] = [];
      let last: string | null = cursor;
      for await (const line of lines) {
        if (!line.trim()) continue;
        const raw = JSON.parse(line) as RawListing;
        const updatedAt = String(raw.sourceUpdatedAt ?? "");
        if (cursor && updatedAt <= cursor) continue;
        page.push(raw);
        last = updatedAt;
        if (page.length >= pageSize) {
          yield { items: page, nextCursor: last };
          page = [];
        }
      }
      if (page.length) yield { items: page, nextCursor: last };
    },

    normalize(raw): NormalizedListing {
      // The synthetic generator already emits the normalized shape; validation guards drift.
      return NormalizedListingSchema.parse(raw);
    },

    /** Synthetic photos are rendered on demand by /media, so they need no download step. */
    inlineMedia(url) {
      const storageKey = syntheticStorageKey(url);
      if (!storageKey) return null;
      return { storageKey, blurDataUrl: syntheticBlurDataUrl(url), width: 1600, height: 1067 };
    },
  };
}
