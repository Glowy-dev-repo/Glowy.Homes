import { isUuid } from "@/lib/listings/detail";
import { fail, ok, unauthorized } from "@/server/api/respond";
import { currentUserId } from "@/server/api/session";
import { removeShare } from "@/server/data/shares";
import { rateLimitWrite } from "@/server/api/rate-limit";

/** Either person can stop sharing; the owner can cancel a pending invite. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!isUuid(id) || !(await removeShare(userId, id))) return fail(404, { code: "not_found", message: "That share was not found." });
  return ok({ removed: true });
}
