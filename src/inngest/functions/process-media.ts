import { z } from "zod";
import { sqlClient } from "@/db";
import { processMedia } from "@/lib/media/process";
import { inngest } from "../client";

const MediaQueued = z.object({ mediaId: z.string().uuid() });

/** process_media (docs/03 section 2): one run per media row, 20 at a time, 3 retries with backoff. */
export const processMediaFn = inngest.createFunction(
  { id: "process-media", concurrency: { limit: 20 }, retries: 3, triggers: [{ event: "media/queued" }] },
  async ({ event, step }) => {
    const { mediaId } = MediaQueued.parse(event.data);
    return step.run("process", () => processMedia(sqlClient, mediaId));
  },
);
