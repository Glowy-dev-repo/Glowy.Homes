import type { InlineMedia } from "../ingest";
import type { FeedSource, ListingFeedAdapter } from "../types";
import { syntheticAdapter } from "./synthetic";

export function configuredFeedSource(): FeedSource {
  const value = process.env.LISTING_FEED ?? "synthetic";
  if (value === "synthetic" || value === "reso" || value === "crea_ddf" || value === "csv") return value;
  throw new Error(`Unknown LISTING_FEED "${value}"`);
}

/**
 * Licensed adapters (RESO Web API, CREA DDF) need a signed data agreement and credentials; until
 * then they are hard blockers (CLAUDE.md section 8.2) rather than silent fallbacks.
 */
export function getAdapter(source: FeedSource = configuredFeedSource()): ListingFeedAdapter & { inlineMedia?: InlineMedia } {
  switch (source) {
    case "synthetic":
      return syntheticAdapter();
    case "reso":
      throw new Error("RESO adapter requires RESO_BASE_URL and RESO_ACCESS_TOKEN from a licensed MLS agreement.");
    case "crea_ddf":
      throw new Error("CREA DDF adapter requires CREA_DDF_CLIENT_ID and CREA_DDF_CLIENT_SECRET from a DDF agreement.");
    case "csv":
      throw new Error("CSV imports run through the admin upload flow, not the scheduled feed.");
  }
}
