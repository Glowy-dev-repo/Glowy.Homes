import { isUuid } from "@/lib/listings/detail";
import { getOrComputeEstimate } from "@/lib/valuation/read";
import { fail, ok } from "@/server/api/respond";
import { rateLimit } from "@/server/api/rate-limit";
import { ESTIMATE_DISCLAIMER } from "@/types/valuation";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const { id } = await params;
  if (!isUuid(id)) return fail(404, { code: "not_found", message: "Property not found." });
  // The disclaimer travels with the data so every client can show it next to the numbers.
  return ok(await getOrComputeEstimate(id), { disclaimer: ESTIMATE_DISCLAIMER });
}
