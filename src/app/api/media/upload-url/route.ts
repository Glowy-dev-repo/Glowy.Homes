import { auth } from "@/lib/auth";
import { presignUpload, r2Configured, UploadRequest, uploadKey } from "@/lib/media/r2";
import { signUpload } from "@/lib/media/upload-token";
import { invalid, ok, unauthorized } from "@/server/api/respond";
import { rateLimitWrite } from "@/server/api/rate-limit";

/**
 * docs/02 POST /api/media/upload-url. With R2: a presigned PUT limited to image types and 10 MB.
 * Without R2 (local development): a signed token for a direct upload to /api/media/upload.
 */
export async function POST(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const body: unknown = await req.json().catch(() => null);
  // Uploads always land under the caller's own folder.
  const parsed = UploadRequest.safeParse({ ...(body as object), prefix: `uploads/${session.user.id}` });
  if (!parsed.success) return invalid(parsed.error);

  if (r2Configured()) return ok({ mode: "presigned" as const, ...(await presignUpload(parsed.data)) });
  const key = uploadKey(parsed.data).replace(/\.[a-z]+$/, "");
  const token = signUpload(session.user.id, key);
  return ok({ mode: "direct" as const, url: `/api/media/upload?key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`, key });
}
