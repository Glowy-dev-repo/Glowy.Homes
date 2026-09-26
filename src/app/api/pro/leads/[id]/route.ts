import { z } from "zod";
import { LEAD_STATUSES } from "@/db/schema/leads";
import { isUuid } from "@/lib/listings/detail";
import { fail, invalid, ok } from "@/server/api/respond";
import { requirePro } from "@/server/api/pro";
import { consumerActivity, leadForPro, messages, updateLeadByPro } from "@/server/data/pro-leads";

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

const Patch = z
  .object({ status: z.enum(LEAD_STATUSES).exclude(["unassigned"]).optional(), note: z.string().trim().min(1).max(2000).optional() })
  .refine((v) => v.status || v.note, "Change the status or add a note.");

export async function PATCH(req: Request, { params }: Ctx) {
  const who = await requirePro();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  return (await updateLeadByPro(who.pro.proId, id, parsed.data)) ? ok({ updated: true }) : notFound();
}
