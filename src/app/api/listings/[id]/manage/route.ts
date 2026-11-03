import { z } from "zod";
import { brand } from "@/config/brand";
import { isUuid } from "@/lib/listings/detail";
import { fail, invalid, ok, unauthorized } from "@/server/api/respond";
import { currentUserId } from "@/server/api/session";
import { updateOwnerListing } from "@/server/data/user-listings";
import { rateLimitWrite } from "@/server/api/rate-limit";

const Patch = z
  .object({ status: z.enum(["active", "pending", "sold", "leased", "withdrawn"]).optional(), price: z.number().int().positive().optional() })
  .refine((v) => v.status || v.price, "Change the status or the price.");

/** Owner updates to their own live listing. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return fail(404, { code: "not_found", message: "Listing not found." });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const r = await updateOwnerListing(userId, id, parsed.data);
  if (r === "not_found") return fail(404, { code: "not_found", message: "Listing not found." });
  if (r === "not_live") return fail(409, { code: "not_live", message: "This listing is not live yet." });
  if (r === "invalid") return fail(400, { code: "invalid_status", message: "That status does not apply to this listing." });
  if (r === "price_check") {
    return fail(400, { code: "price_check", message: `That price is far from the estimated value for this home. If it is right, email ${brand.supportEmail} and we will review it.` });
  }
  return ok({ updated: true });
}
