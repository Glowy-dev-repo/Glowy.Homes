import { sqlClient } from "@/db";
import { isUuid } from "@/lib/listings/detail";
import { setProStatus } from "@/lib/pros/status";
import { ProStatusChange } from "@/lib/pros/status-rules";
import { fail, invalid, ok } from "@/server/api/respond";
import { requireAdmin } from "@/server/api/pro";
import { rateLimitWrite } from "@/server/api/rate-limit";

const MESSAGES = {
  not_found: [404, "Agent not found."],
  bad_transition: [409, "That change is not possible from the agent's current status. Reload the page."],
  license_taken: [409, "Another working partner account holds this DRE license. Suspend that account first."],
} as const;

/** Approve, reject, suspend or reactivate a partner agent (lib/pros/status.ts). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!isUuid(id)) return fail(404, { code: "not_found", message: MESSAGES.not_found[1] });
  const parsed = ProStatusChange.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const result = await setProStatus(sqlClient, id, parsed.data.action, { adminUserId: who.userId, reason: parsed.data.reason });
  if (!result.ok) {
    const [status, message] = MESSAGES[result.code];
    return fail(status, { code: result.code, message });
  }
  return ok(result);
}
