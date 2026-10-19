import type { InlineMedia } from "../ingest";
import type { FeedSource, ListingFeedAdapter } from "../types";
import { simplyRetsAdapter } from "./simplyrets";
import { syntheticAdapter } from "./synthetic";

const SOURCES: FeedSource[] = ["synthetic", "reso", "crea_ddf", "csv", "simplyrets"];

export function configuredFeedSource(): FeedSource {
  const value = process.env.LISTING_FEED ?? "synthetic";
  if ((SOURCES as string[]).includes(value)) return value as FeedSource;
  throw new Error(`Unknown LISTING_FEED "${value}"`);
}

/**
 * Licensed adapters need a signed data agreement and credentials; until then they are hard blockers
 * (CLAUDE.md section 8.2) rather than silent fallbacks.
 */
export function getAdapter(source: FeedSource = configuredFeedSource()): ListingFeedAdapter & { inlineMedia?: InlineMedia } {
  switch (source) {
    case "synthetic":
      return syntheticAdapter();
    case "simplyrets": {
      const key = process.env.SIMPLYRETS_API_KEY?.trim();
      const secret = process.env.SIMPLYRETS_API_SECRET?.trim();
      if (!key || !secret) throw new Error("SimplyRETS adapter requires SIMPLYRETS_API_KEY and SIMPLYRETS_API_SECRET from the SimplyRETS account.");
      return simplyRetsAdapter({ key, secret });
    }
    case "reso":
      throw new Error("RESO adapter requires RESO_BASE_URL and RESO_ACCESS_TOKEN from a licensed MLS agreement.");
    case "crea_ddf":
      throw new Error("CREA DDF adapter requires CREA_DDF_CLIENT_ID and CREA_DDF_CLIENT_SECRET from a DDF agreement.");
    case "csv":
      throw new Error("CSV imports run through the admin upload flow, not the scheduled feed.");
  }
}
