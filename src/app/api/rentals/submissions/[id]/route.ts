import { z } from "zod";
import { isUuid } from "@/lib/listings/detail";
import { SUBMISSION_STATUSES } from "@/lib/listings/user-listing-schema";
import { fail, invalid, ok, unauthorized } from "@/server/api/respond";
import { currentUserId } from "@/server/api/session";
import { updateSubmission } from "@/server/data/rentals";

const Patch = z
  .object({ status: z.enum(SUBMISSION_STATUSES).exclude(["withdrawn"]).optional(), landlordNotes: z.string().trim().max(1000).optional() })
  .refine((v) => v.status || v.landlordNotes !== undefined, "Change the status or add a note.");

/** Landlord reviews an application to one of their listings (docs/01 R5). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return fail(404, { code: "not_found", message: "Application not found." });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  return (await updateSubmission(userId, id, parsed.data)) ? ok({ updated: true }) : fail(404, { code: "not_found", message: "Application not found." });
}
