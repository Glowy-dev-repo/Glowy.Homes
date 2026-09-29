import { z } from "zod";
import { fail, invalid, ok, unauthorized } from "@/server/api/respond";
import { rateLimit, rateLimitWrite } from "@/server/api/rate-limit";
import { currentUserId } from "@/server/api/session";
import { inviteCobuyer, MAX_SHARES } from "@/server/data/shares";

const Body = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.") });

/** Invite a cobuyer to a shared saved homes list (docs/05 Phase 6 task 4). */
export async function POST(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const limited = rateLimit(req);
  if (limited) return limited;
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const result = await inviteCobuyer(userId, parsed.data.email);
  if (result === "self") return fail(400, { code: "self", message: "Invite someone other than yourself." });
  if (result === "limit") return fail(409, { code: "limit", message: `You can share with up to ${MAX_SHARES} people.` });
  if (result === "too_soon") return fail(429, { code: "too_soon", message: "We sent this invitation less than an hour ago. Ask them to check their inbox." });
  if (result === "daily_limit") return fail(429, { code: "daily_limit", message: "You have sent the most invitations allowed today. Try again tomorrow." });
  if (result === "already_shared") return fail(409, { code: "already_shared", message: "You already share your list with this person." });
  return ok({ invited: true }, {}, { status: 201 });
}
