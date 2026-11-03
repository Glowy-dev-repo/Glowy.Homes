import { z } from "zod";
import { sqlClient } from "@/db";
import { isUuid } from "@/lib/listings/detail";
import { inngest } from "@/inngest/client";
import { adminReassign } from "@/lib/leads/route";
import { fail, invalid, ok } from "@/server/api/respond";
import { requireAdmin } from "@/server/api/pro";
import { rateLimitWrite } from "@/server/api/rate-limit";

/** docs/01 AD4: manual reassignment, recorded in routing_log. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!isUuid(id)) return fail(404, { code: "not_found", message: "Lead not found." });
  const parsed = z.object({ proId: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const done = await adminReassign(sqlClient, id, parsed.data.proId, who.userId);
  if (done === "unchanged") return ok({ reassigned: false });
  if (done === "not_found") {
    return fail(404, { code: "not_found", message: "Choose an active partner agent who is accepting leads and is not the listing agent. Closed and lost leads cannot be reassigned." });
  }
  // Reminder to the agent, then a note to admins, if nobody replies (inngest lead-follow-up).
  await Promise.race([
    inngest.send({ name: "lead/assigned", data: { leadId: id, proId: parsed.data.proId } }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("queue timeout after 2s")), 2000)),
  ]).catch((e) => console.warn(`[leads] could not queue follow up for ${id}: ${e instanceof Error ? e.message : String(e)}`));
  return ok({ reassigned: true });
}
