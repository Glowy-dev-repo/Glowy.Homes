import { sqlClient } from "@/db";
import { idxApiKey, idxClient } from "@/lib/idx/client";
import { syncIdxLeads } from "@/lib/idx/sync-leads";
import { inngest } from "../client";

/**
 * Every 10 minutes, imports people who registered on the IDX Broker listing search and sends each
 * one to lead routing, so they reach the partner agent for that ZIP code like leads from our own pages.
 * Off until IDX_BROKER_API_KEY is set; IDX_LEAD_SYNC=off pauses it.
 */
export const syncIdxLeadsFn = inngest.createFunction(
  { id: "sync-idx-leads", concurrency: { limit: 1 }, retries: 2, triggers: [{ cron: "*/10 * * * *" }, { event: "idx/leads.sync.requested" }] },
  async ({ step }) => {
    const key = idxApiKey();
    if (!key || process.env.IDX_LEAD_SYNC === "off") return { skipped: "IDX lead sync is not configured" };
    const created: string[] = [];
    const stats = await step.run("sync", () =>
      syncIdxLeads(sqlClient, idxClient(key), {
        onCreated: async (leadId) => {
          created.push(leadId);
        },
      }).then((s) => ({ ...s, createdIds: created })),
    );
    if (stats.createdIds.length) {
      await step.sendEvent(
        "route-new-leads",
        stats.createdIds.map((leadId) => ({ name: "lead/created" as const, data: { leadId } })),
      );
    }
    return stats;
  },
);
