import { LeadPatch } from "@/lib/leads/closing";
import { isUuid } from "@/lib/listings/detail";
import { fail, invalid, ok } from "@/server/api/respond";
import { requirePro } from "@/server/api/pro";
import { consumerActivity, leadForPro, messages, notifyLeadClosed, updateLeadByPro } from "@/server/data/pro-leads";
import { trackServer } from "@/lib/analytics/server";
import { rateLimitWrite } from "@/server/api/rate-limit";

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => fail(404, { code: "not_found", message: "Lead not found." });

export async function GET(_req: Request, { params }: Ctx) {
  const who = await requirePro();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  // Scoped to the assigned pro: any other pro gets a 404, not a 403, so ids do not leak.
  const lead = await leadForPro(who.pro.proId, id);
  if (!lead) return notFound();
  const [activity, thread] = await Promise.all([consumerActivity(lead.consumerUserId), messages(id, who.userId)]);
  return ok({ lead, activity, messages: thread });
}


export async function PATCH(req: Request, { params }: Ctx) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const who = await requirePro();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const parsed = LeadPatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  if (!(await updateLeadByPro(who.pro.proId, id, parsed.data))) return notFound();
  if (parsed.data.status) await trackServer("lead_status_change", { leadId: id, status: parsed.data.status }, who.userId);
  if (parsed.data.status === "closed") await notifyLeadClosed(id).catch((e) => console.warn(`[leads] closing email failed: ${e}`));
  return ok({ updated: true });
}
