import { revalidatePath } from "next/cache";
import { ProProfileUpdate } from "@/lib/pros/schema";
import { invalid, ok } from "@/server/api/respond";
import { requirePro } from "@/server/api/pro";
import { updatePro } from "@/server/data/pros";
import { rateLimitWrite } from "@/server/api/rate-limit";

export async function PATCH(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const who = await requirePro({ allowInactive: true });
  if ("response" in who) return who.response;
  const parsed = ProProfileUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  await updatePro(who.pro.proId, parsed.data);
  revalidatePath("/agent/[slug]", "page");
  revalidatePath("/agents/[city]", "page");
  return ok({ updated: true });
}
