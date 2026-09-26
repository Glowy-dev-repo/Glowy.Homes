import { z } from "zod";
import { auth } from "@/lib/auth";
import { fail, invalid, ok, unauthorized } from "@/server/api/respond";
import { rateLimit, rateLimitWrite } from "@/server/api/rate-limit";
import { acceptInvite } from "@/server/data/shares";

const Body = z.object({ token: z.string().min(20).max(100) });

export async function POST(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const limited = rateLimit(req);
  if (limited) return limited;
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const result = await acceptInvite(session.user.id, session.user.email, parsed.data.token);
  if (result === "invalid") return fail(404, { code: "invalid", message: "This invitation has expired or was already used." });
  if (result === "own_invite") return fail(400, { code: "own_invite", message: "This is your own invitation." });
  if (result === "wrong_account") return fail(403, { code: "wrong_account", message: "This invitation was sent to a different email. Sign in with that email to accept it." });
  return ok({ accepted: true });
}
