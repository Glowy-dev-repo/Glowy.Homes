import { auth } from "@/lib/auth";
import { presignUpload, r2Configured, UploadRequest } from "@/lib/media/r2";
import { fail, invalid, ok, unauthorized } from "@/server/api/respond";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const body: unknown = await req.json().catch(() => null);
  // Uploads always land under the caller's own folder.
  const parsed = UploadRequest.safeParse({ ...(body as object), prefix: `uploads/${session.user.id}` });
  if (!parsed.success) return invalid(parsed.error);

  if (!r2Configured()) {
    return fail(503, { code: "storage_unavailable", message: "Photo uploads are not available right now." });
  }
  return ok(await presignUpload(parsed.data));
}
