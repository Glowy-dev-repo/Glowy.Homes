import { sqlClient } from "@/db";
import { isUuid } from "@/lib/listings/detail";
import { adminCloseAsSpam } from "@/lib/leads/route";
import { fail, ok } from "@/server/api/respond";
import { requireAdmin } from "@/server/api/pro";
import { rateLimitWrite } from "@/server/api/rate-limit";

/** Admin closes a junk lead so it leaves the waiting queue (recorded in routing_log). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!isUuid(id)) return fail(404, { code: "not_found", message: "Lead not found." });
  if (!(await adminCloseAsSpam(sqlClient, id, who.userId))) return fail(404, { code: "not_found", message: "That lead was already closed or does not exist." });
  return ok({ closed: true });
}
