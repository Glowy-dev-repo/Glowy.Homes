import { z } from "zod";
import { sqlClient } from "@/db";
import { isUuid } from "@/lib/listings/detail";
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
  return done ? ok({ reassigned: true }) : fail(404, { code: "not_found", message: "Lead or active pro not found." });
}
