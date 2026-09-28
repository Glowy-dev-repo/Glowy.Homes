import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sqlClient } from "@/db";
import { isUuid } from "@/lib/listings/detail";
import { fail, invalid, ok } from "@/server/api/respond";
import { rateLimitWrite } from "@/server/api/rate-limit";
import { requireAdmin } from "@/server/api/pro";

const Patch = z.object({ hideEstimate: z.boolean() });

/** Seller requests reported by the listing broker: hide the automated estimate (CSMAR Rule 12.16.15). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const { id } = await params;
  if (!isUuid(id)) return fail(404, { code: "not_found", message: "Listing not found." });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const rows = await sqlClient`update listings set hide_estimate = ${parsed.data.hideEstimate}, updated_at = now() where id = ${id} returning id`;
  if (!rows.length) return fail(404, { code: "not_found", message: "Listing not found." });
  revalidatePath("/listing/[id]/[slug]", "page");
  return ok({ id, hideEstimate: parsed.data.hideEstimate });
}
