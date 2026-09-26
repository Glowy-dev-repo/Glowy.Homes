import { CreateSavedSearch } from "@/lib/saved-search-schema";
import { fail, invalid, ok, unauthorized } from "@/server/api/respond";
import { currentUserId } from "@/server/api/session";
import { createSavedSearch, MAX_SAVED_SEARCHES, savedSearches } from "@/server/data/saved";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  return ok(await savedSearches(userId));
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const parsed = CreateSavedSearch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const row = await createSavedSearch(userId, parsed.data);
  if (row === "limit") {
    return fail(409, { code: "limit_reached", message: `You can keep up to ${MAX_SAVED_SEARCHES} saved searches. Delete one to add another.` });
  }
  return ok(row, {}, { status: 201 });
}
