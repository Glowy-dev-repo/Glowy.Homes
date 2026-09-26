import { sqlClient } from "@/db";
import { inngest } from "../client";
import { market } from "@/config/market";

/** docs/03 section 8: raw events are kept 13 months, then deleted. (No aggregate table yet, see PROGRESS assumptions.) */
export const eventsRetentionFn = inngest.createFunction(
  { id: "events-retention", concurrency: { limit: 1 }, triggers: [{ cron: `TZ=${market.timezone} 30 2 1 * *` }] },
  async ({ step }) =>
    step.run("purge", async () => {
      const result = await sqlClient`delete from events where created_at < now() - interval '13 months'`;
      return { deleted: result.count };
    }),
);
