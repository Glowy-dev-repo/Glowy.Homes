import { ReviewInput } from "@/lib/pros/schema";
import { fail, invalid, ok, unauthorized } from "@/server/api/respond";
import { currentUserId } from "@/server/api/session";
import { submitReview } from "@/server/data/pros";
import { rateLimitWrite } from "@/server/api/rate-limit";

export async function POST(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const parsed = ReviewInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const result = await submitReview(userId, parsed.data);
  switch (result.status) {
    case "created":
      return ok(result, {}, { status: 201 });
    case "not_closed":
      return fail(409, { code: "not_closed", message: "You can review a professional once your inquiry is closed." });
    case "exists":
      return fail(409, { code: "exists", message: "You already reviewed this professional for this inquiry." });
    default:
      return fail(404, { code: "not_found", message: "Inquiry not found." });
  }
}
