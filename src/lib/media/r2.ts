import "server-only";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { env } from "@/lib/env";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export const UploadRequest = z.object({
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
  contentLength: z.number().int().positive().max(MAX_UPLOAD_BYTES, "Images must be 10 MB or smaller"),
  /** Logical folder, e.g. "uploads/{userId}". Keys never come from the client verbatim. */
  prefix: z.string().regex(/^[a-z0-9/_-]+$/).max(120),
});
export type UploadRequest = z.infer<typeof UploadRequest>;

const EXT: Record<(typeof UPLOAD_CONTENT_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export function uploadKey(req: UploadRequest, id: string = crypto.randomUUID()): string {
  return `${req.prefix.replace(/\/+$/, "")}/${id}.${EXT[req.contentType]}`;
}

let client: S3Client | undefined;

/** S3 compatible client pointed at Cloudflare R2. */
export function r2(): S3Client {
  const e = env();
  if (!e.R2_ACCOUNT_ID || !e.R2_ACCESS_KEY_ID || !e.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.");
  }
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY },
  });
  return client;
}

export function r2Configured(): boolean {
  const e = env();
  return !!(e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY);
}

/**
 * Presigned PUT limited to one key, one content type and an exact length, valid for 5 minutes.
 * Signing is local: no network call happens here.
 */
export async function presignUpload(req: UploadRequest, s3: S3Client = r2()) {
  const parsed = UploadRequest.parse(req);
  const key = uploadKey(parsed);
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: env().R2_BUCKET,
      Key: key,
      ContentType: parsed.contentType,
      ContentLength: parsed.contentLength,
    }),
    { expiresIn: 300 },
  );
  return { url, key, publicUrl: publicMediaUrl(key) };
}

export function publicMediaUrl(key: string): string {
  return `${env().NEXT_PUBLIC_MEDIA_BASE_URL.replace(/\/+$/, "")}/${key}`;
}
