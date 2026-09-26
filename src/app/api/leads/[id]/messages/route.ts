import { z } from "zod";
import { isUuid } from "@/lib/listings/detail";
import { fail, invalid, ok, unauthorized } from "@/server/api/respond";
import { currentUserId } from "@/server/api/session";
import { addMessage, leadParticipant, messages } from "@/server/data/pro-leads";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ body: z.string().trim().min(1, "Write a message.").max(4000) });

async function participant(params: Ctx["params"]) {
  const userId = await currentUserId();
  if (!userId) return { error: unauthorized() };
  const { id } = await params;
  if (!isUuid(id)) return { error: fail(404, { code: "not_found", message: "Conversation not found." }) };
  const role = await leadParticipant(id, userId);
  if (!role) return { error: fail(404, { code: "not_found", message: "Conversation not found." }) };
  return { userId, id, role };
}

/** docs/01 P6: in app messages between the consumer and the assigned pro only. */
export async function GET(_req: Request, ctx: Ctx) {
  const p = await participant(ctx.params);
  if ("error" in p) return p.error;
  return ok(await messages(p.id, p.userId));
}

export async function POST(req: Request, ctx: Ctx) {
  const p = await participant(ctx.params);
  if ("error" in p) return p.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  return ok(await addMessage(p.id, p.userId, p.role, parsed.data.body), {}, { status: 201 });
}
