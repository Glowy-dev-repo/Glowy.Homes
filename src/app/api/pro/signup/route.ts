import { ProSignup } from "@/lib/pros/schema";
import { fail, invalid, ok, unauthorized } from "@/server/api/respond";
import { currentUserId } from "@/server/api/session";
import { createPro } from "@/server/data/pros";

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const parsed = ProSignup.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const result = await createPro(userId, parsed.data);
  if (result.status === "exists") return fail(409, { code: "exists", message: "You already have a pro profile." });
  return ok(result, {}, { status: 201 });
}
