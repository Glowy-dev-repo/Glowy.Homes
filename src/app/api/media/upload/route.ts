import { auth } from "@/lib/auth";
import { encodeVariants } from "@/lib/media/process";
import { MAX_UPLOAD_BYTES, UPLOAD_CONTENT_TYPES } from "@/lib/media/r2";
import { putVariant } from "@/lib/media/storage";
import { verifyUpload } from "@/lib/media/upload-token";
import { fail, ok, unauthorized } from "@/server/api/respond";

/** Direct image upload when R2 is not configured: validates, processes with sharp and stores locally. */
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  if (!key.startsWith(`uploads/${session.user.id}/`) || !verifyUpload(session.user.id, key, url.searchParams.get("token"))) {
    return fail(403, { code: "bad_token", message: "This upload link has expired. Try adding the photo again." });
  }
  const type = req.headers.get("content-type") ?? "";
  if (!(UPLOAD_CONTENT_TYPES as readonly string[]).includes(type)) {
    return fail(415, { code: "unsupported_type", message: "Use a JPEG, PNG, WebP or AVIF image." });
  }
  const body = Buffer.from(await req.arrayBuffer());
  if (body.byteLength > MAX_UPLOAD_BYTES) return fail(413, { code: "too_large", message: "Images must be 10 MB or smaller." });

  try {
    const encoded = await encodeVariants(body);
    let storageKey = key;
    for (const v of encoded.variants) storageKey = await putVariant(key, v.width, v.body);
    return ok({ storageKey, blurDataUrl: encoded.blurDataUrl, width: encoded.width, height: encoded.height });
  } catch {
    return fail(422, { code: "unreadable_image", message: "We could not read that image. Try a different file." });
  }
}
