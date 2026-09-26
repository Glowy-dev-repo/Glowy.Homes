import { revalidatePath } from "next/cache";
import { ProProfileUpdate } from "@/lib/pros/schema";
import { invalid, ok } from "@/server/api/respond";
import { requirePro } from "@/server/api/pro";
import { updatePro } from "@/server/data/pros";

export async function PATCH(req: Request) {
  const who = await requirePro();
  if ("response" in who) return who.response;
  const parsed = ProProfileUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  await updatePro(who.pro.proId, parsed.data);
  revalidatePath("/agent/[slug]", "page");
  revalidatePath("/agents/[city]", "page");
  return ok({ updated: true });
}
