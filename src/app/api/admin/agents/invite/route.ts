import { AgentInvite } from "@/lib/pros/invite";
import { fail, invalid, ok } from "@/server/api/respond";
import { requireAdmin } from "@/server/api/pro";
import { rateLimitWrite } from "@/server/api/rate-limit";
import { inviteAgent } from "@/server/data/pro-invites";

/** Admin invites an agent to apply. Grants nothing: the agent still applies and is approved. */
export async function POST(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const parsed = AgentInvite.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const result = await inviteAgent(parsed.data, who.userId);
  if (result.status === "already_partner") {
    return fail(409, { code: "already_partner", message: "This email already has a partner account. Find them in the list below." });
  }
  return ok({ invited: true }, {}, { status: 201 });
}
