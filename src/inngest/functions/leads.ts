import { z } from "zod";
import { sqlClient } from "@/db";
import { checkFirstResponse, refreshProResponseTimes, routeLead } from "@/lib/leads/route";
import { responseWindowMs } from "@/lib/leads/routing";
import { inngest } from "../client";
import { market } from "@/config/market";

const retryEvery = () => {
  const s = Number(process.env.LEAD_RETRY_SECONDS);
  return Number.isFinite(s) && s > 0 ? s * 1000 : 30 * 60_000;
};

/**
 * route_lead (docs/03 section 5): assign within seconds, then watch for a first response and
 * reassign if none comes in time. Unassigned leads retry every 30 minutes for 24 hours.
 */
export const routeLeadFn = inngest.createFunction(
  { id: "route-lead", retries: 3, concurrency: { limit: 10 }, triggers: [{ event: "lead/created" }] },
  async ({ event, step }) => {
    const { leadId } = z.object({ leadId: z.string().uuid() }).parse(event.data);
    let outcome = await step.run("route", () => routeLead(sqlClient, leadId, "initial"));

    // Unassigned: retry for up to 24 hours.
    for (let i = 0; outcome.status === "unassigned" && i * retryEvery() < 24 * 3600_000; i++) {
      await step.sleep(`retry-wait-${i}`, retryEvery());
      outcome = await step.run(`retry-${i}`, () => routeLead(sqlClient, leadId, "retry"));
    }

    // Assigned: reassign up to three times if nobody responds in their window.
    for (let i = 0; outcome.status === "assigned" && i < 3; i++) {
      const proId = outcome.proId;
      const [pro] = await step.run(`pro-type-${i}`, () => sqlClient<{ proType: string }[]>`select pro_type as "proType" from pros where id = ${proId}`);
      // Owners and landlords answer about their own listing; there is nobody to reassign to.
      if (["landlord", "owner", "property_manager"].includes(pro?.proType ?? "")) break;
      await step.sleep(`response-window-${i}`, responseWindowMs(pro?.proType ?? "agent"));
      const checked = await step.run(`check-response-${i}`, () => checkFirstResponse(sqlClient, leadId, proId));
      if (checked.status === "responded") break;
      outcome = checked;
    }
    return outcome;
  },
);

/** Safety net: leads that never got routed (queue unavailable at creation) are picked up here. */
export const sweepLeadsFn = inngest.createFunction(
  { id: "sweep-unrouted-leads", triggers: [{ cron: "*/30 * * * *" }] },
  async ({ step }) => {
    const ids = await step.run("find", async () =>
      (
        await sqlClient<{ id: string }[]>`
          select id from leads where assigned_pro_id is null and status in ('new', 'unassigned')
            and created_at < now() - interval '2 minutes' and created_at > now() - interval '24 hours'
          limit 200`
      ).map((r) => r.id),
    );
    for (const id of ids) await step.run(`route-${id}`, () => routeLead(sqlClient, id, "retry"));
    return { swept: ids.length };
  },
);

export const proResponseTimesFn = inngest.createFunction(
  { id: "pro-response-times", triggers: [{ cron: `TZ=${market.timezone} 15 3 * * *` }] },
  async ({ step }) => {
    await step.run("refresh", () => refreshProResponseTimes(sqlClient));
  },
);
