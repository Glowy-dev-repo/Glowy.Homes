import { isUuid } from "@/lib/listings/detail";
import { UpdateSavedSearch } from "@/lib/saved-search-schema";
import { fail, invalid, ok, unauthorized } from "@/server/api/respond";
import { currentUserId } from "@/server/api/session";
import { deleteSavedSearch, updateSavedSearch } from "@/server/data/saved";
import { rateLimitWrite } from "@/server/api/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => fail(404, { code: "not_found", message: "Saved search not found." });

export async function PATCH(req: Request, { params }: Ctx) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const parsed = UpdateSavedSearch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  // Owner scoped: another user's id simply matches no row.
  const row = await updateSavedSearch(userId, id, parsed.data);
  return row ? ok(row) : notFound();
}

export async function DELETE(req: Request, { params }: Ctx) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  return (await deleteSavedSearch(userId, id)) ? ok({ deleted: true }) : notFound();
}
