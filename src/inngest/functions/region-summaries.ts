import { sqlClient } from "@/db";
import { generateRegionSummaries } from "@/lib/regions/summary";
import { inngest } from "../client";
import { market } from "@/config/market";

/** Weekly neighborhood summaries (docs/05 Phase 6 task 3), after the Sunday night stats refresh. */
export const regionSummariesFn = inngest.createFunction(
  { id: "generate-region-summaries", concurrency: { limit: 1 }, triggers: [{ cron: `TZ=${market.timezone} 0 4 * * 1` }, { event: "regions/summaries.requested" }] },
  async ({ step }) => step.run("generate", () => generateRegionSummaries(sqlClient)),
);
