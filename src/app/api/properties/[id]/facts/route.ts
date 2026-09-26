import { isUuid } from "@/lib/listings/detail";
import { getPropertyEstimate } from "@/lib/valuation/read";
import { fail, invalid, ok, unauthorized } from "@/server/api/respond";
import { currentUserId } from "@/server/api/session";
import { FactsPatch, updateFacts } from "@/server/data/owner";
import { rateLimitWrite } from "@/server/api/rate-limit";

/** Owner fact override (docs/02 PATCH /api/properties/[id]/facts): owner only, revalues immediately. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return fail(404, { code: "not_found", message: "Property not found." });
  const parsed = FactsPatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);

  const result = await updateFacts(userId, id, parsed.data);
  if (result.status === "forbidden") return fail(403, { code: "forbidden", message: "Only the owner who claimed this home can edit its facts." });
  return ok(await getPropertyEstimate(id));
}
