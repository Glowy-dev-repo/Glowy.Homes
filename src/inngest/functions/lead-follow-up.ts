import { z } from "zod";
import { sqlClient } from "@/db";
import { followUpAssigned } from "@/lib/leads/follow-up";
import { responseWindowMs } from "@/lib/leads/routing";
import { inngest } from "../client";

/**
 * After admin assigns a lead: wait one response window, remind the agent if they have not replied, wait
 * again, then tell the admins. A newer assignment of the same lead cancels this one.
 */
export const leadFollowUpFn = inngest.createFunction(
  {
    id: "lead-follow-up",
    retries: 3,
    cancelOn: [{ event: "lead/assigned", if: "async.data.leadId == event.data.leadId && async.data.proId != event.data.proId" }],
    triggers: [{ event: "lead/assigned" }],
  },
  async ({ event, step }) => {
    const { leadId, proId } = z.object({ leadId: z.string().uuid(), proId: z.string().uuid() }).parse(event.data);
    await step.sleep("first-window", responseWindowMs());
    const first = await step.run("remind", () => followUpAssigned(sqlClient, leadId, proId, "remind"));
    if (first !== "reminded") return first;
    await step.sleep("second-window", responseWindowMs());
    return step.run("escalate", () => followUpAssigned(sqlClient, leadId, proId, "escalate"));
  },
);
