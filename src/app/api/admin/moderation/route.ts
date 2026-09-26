import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, invalid, ok } from "@/server/api/respond";
import { requireAdmin } from "@/server/api/pro";
import { decideModeration, moderationQueue } from "@/server/data/admin";
import { applyListingDecision } from "@/server/data/listing-moderation";
import { rateLimitWrite } from "@/server/api/rate-limit";

export async function GET() {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  return ok(await moderationQueue());
}

const Decision = z
  .object({ id: z.string().uuid(), decision: z.enum(["approve", "reject"]), note: z.string().trim().max(1000).optional() })
  .refine((v) => v.decision === "approve" || !!v.note, { message: "Give a reason so the submitter knows what to fix.", path: ["note"] });

export async function PATCH(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const parsed = Decision.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const item = await decideModeration(parsed.data.id, parsed.data.decision, parsed.data.note ?? null, who.userId);
  if (!item) return fail(404, { code: "not_found", message: "That item was already decided or does not exist." });
  if (item.itemType === "listing") await applyListingDecision(item.itemId, parsed.data.decision, parsed.data.note ?? null);
  if (item.itemType === "pro" || item.itemType === "review") {
    revalidatePath("/agent/[slug]", "page");
    revalidatePath("/agents/[city]", "page");
  }
  return ok({ decided: true });
}
