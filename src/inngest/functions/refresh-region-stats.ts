import { revalidatePath } from "next/cache";
import { sqlClient } from "@/db";
import { refreshRegionStats } from "@/lib/regions/stats";
import { inngest } from "../client";

/** refresh_region_stats (docs/03 section 4): nightly, and after each feed run. */
export const refreshRegionStatsFn = inngest.createFunction(
  {
    id: "refresh-region-stats",
    concurrency: { limit: 1 },
    triggers: [{ cron: "TZ=America/Toronto 0 3 * * *" }, { event: "feed/completed" }, { event: "regions/stats.requested" }],
  },
  async ({ step }) => {
    const regions = await step.run("refresh", () => refreshRegionStats(sqlClient));
    await step.run("revalidate", () => {
      revalidatePath("/", "page");
      revalidatePath("/homes/[city]", "page");
      revalidatePath("/homes/[city]/[neighborhood]", "page");
      revalidatePath("/rentals/[city]", "page");
    });
    return { regions };
  },
);
