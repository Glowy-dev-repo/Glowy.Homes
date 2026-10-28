import { sqlClient } from "@/db";
import { putVariant } from "@/lib/media/storage";
import { encodeProPhoto, MAX_PHOTO_BYTES, PHOTO_TYPES, PhotoError } from "@/lib/pros/photo";
import { revalidateSitePage } from "@/lib/revalidate";
import { fail, ok } from "@/server/api/respond";
import { requirePro } from "@/server/api/pro";
import { rateLimitWrite } from "@/server/api/rate-limit";

const WRONG_TYPE = "Choose a JPG, PNG or WebP photo.";
const TOO_LARGE = "Photos can be up to 5 MB.";

function refreshProfiles() {
  revalidateSitePage("/agent/[slug]", "page");
  revalidateSitePage("/agents/[city]", "page");
}

/** Upload the signed in agent's profile photo (multipart field "photo"). */
export async function POST(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const who = await requirePro({ allowInactive: true });
  if ("response" in who) return who.response;
  // Refuse oversized bodies before reading them.
  if (Number(req.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES + 64 * 1024) return fail(400, { code: "too_large", message: TOO_LARGE });
  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) return fail(400, { code: "wrong_type", message: WRONG_TYPE });
  if (file.size > MAX_PHOTO_BYTES) return fail(400, { code: "too_large", message: TOO_LARGE });
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return fail(400, { code: "wrong_type", message: WRONG_TYPE });

  let variants: { width: number; body: Buffer }[];
  try {
    variants = await encodeProPhoto(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof PhotoError) return fail(400, { code: e.code, message: WRONG_TYPE });
    throw e;
  }
  const base = `pros/${who.pro.proId}/${crypto.randomUUID()}`;
  let key = base;
  for (const v of variants) key = await putVariant(base, v.width, v.body);
  await sqlClient`update pros set photo_url = ${key}, updated_at = now() where id = ${who.pro.proId}`;
  refreshProfiles();
  return ok({ photoUrl: key }, {}, { status: 201 });
}

/** Remove the profile photo; the profile shows initials again. */
export async function DELETE(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const who = await requirePro({ allowInactive: true });
  if ("response" in who) return who.response;
  await sqlClient`update pros set photo_url = null, updated_at = now() where id = ${who.pro.proId}`;
  refreshProfiles();
  return ok({ photoUrl: null });
}
