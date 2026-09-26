import { revalidatePath } from "next/cache";
import { sqlClient } from "@/db";
import { configuredFeedSource, getAdapter } from "@/lib/ingestion/adapters";
import { runIngest } from "@/lib/ingestion/ingest";
import { inngest } from "../client";

const MEDIA_EVENT_BATCH = 500;

/**
 * ingest_feed (docs/03 section 1.3). Every 15 minutes for licensed feeds; on demand
 * (feed/ingest.requested) for synthetic and csv.
 */
export const ingestFeed = inngest.createFunction(
  {
    id: "ingest-feed",
    concurrency: { limit: 1 },
    retries: 2,
    triggers: [{ event: "feed/ingest.requested" }, { cron: "*/15 * * * *" }],
  },
  async ({ event, step }) => {
    const source = configuredFeedSource();
    const scheduled = event.name === "inngest/scheduled.timer";
    if (scheduled && (source === "synthetic" || source === "csv")) return { skipped: `scheduled runs are off for ${source}` };

    const result = await step.run("ingest", async () => {
      const r = await runIngest(sqlClient, getAdapter(source));
      return r;
    });

    for (let i = 0; i < result.queuedMediaIds.length; i += MEDIA_EVENT_BATCH) {
      const batch = result.queuedMediaIds.slice(i, i + MEDIA_EVENT_BATCH);
      await step.sendEvent(
        `media-queued-${i}`,
        batch.map((mediaId) => ({ name: "media/queued" as const, data: { mediaId } })),
      );
    }

    if (result.deactivatedListingIds.length || result.stats.created) {
      await step.run("revalidate", async () => {
        // Browse pages are ISR; refresh them so counts and cards reflect the run.
        revalidatePath("/homes/[city]", "page");
        revalidatePath("/homes/[city]/[neighborhood]", "page");
        revalidatePath("/rentals/[city]", "page");
        for (const id of result.deactivatedListingIds.slice(0, 1000)) revalidatePath(`/listing/${id}`, "layout");
      });
    }

    if (result.soldPropertyIds.length) {
      await step.sendEvent("nearby-sales", { name: "valuation/nearby-sales", data: { propertyIds: result.soldPropertyIds.slice(0, 2000) } });
    }

    await step.sendEvent("feed-completed", {
      name: "feed/completed",
      data: { runId: result.runId, source, status: result.status, stats: result.stats },
    });
    return { runId: result.runId, status: result.status, stats: result.stats };
  },
);
