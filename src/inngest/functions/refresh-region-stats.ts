import { revalidateSitePage } from "@/lib/revalidate";
import { sqlClient } from "@/db";
import { refreshRegionStats } from "@/lib/regions/stats";
import { inngest } from "../client";
import { market } from "@/config/market";

/** refresh_region_stats (docs/03 section 4): nightly, and after each feed run. */
export const refreshRegionStatsFn = inngest.createFunction(
  {
    id: "refresh-region-stats",
    concurrency: { limit: 1 },
    triggers: [{ cron: `TZ=${market.timezone} 0 3 * * *` }, { event: "feed/completed" }, { event: "regions/stats.requested" }],
  },
  async ({ step }) => {
    const regions = await step.run("refresh", () => refreshRegionStats(sqlClient));
    await step.run("revalidate", () => {
      revalidateSitePage("/", "page");
      revalidateSitePage("/homes/[city]", "page");
      revalidateSitePage("/homes/[city]/[neighborhood]", "page");
      revalidateSitePage("/rentals/[city]", "page");
    });
    return { regions };
  },
);
