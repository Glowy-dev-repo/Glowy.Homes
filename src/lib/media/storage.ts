import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import { r2, r2Configured } from "./r2";

// Where processed media variants live. R2 in production; a local folder otherwise, served by
// the app's /media route under keys prefixed "local/".

/** Writable cache and local storage root. Serverless file systems only allow the OS temp dir. */
export const MEDIA_DIR = process.env.MEDIA_DIR ?? (process.env.VERCEL ? resolve(tmpdir(), "media") : resolve(process.cwd(), ".media"));

const SAFE_KEY = /^[A-Za-z0-9/_-]+$/;

export function localPath(key: string, width: number): string {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("Invalid media key");
  return resolve(MEDIA_DIR, key, `${width}.webp`);
}

export async function readLocal(key: string, width: number): Promise<Buffer | null> {
  try {
    return await readFile(localPath(key, width));
  } catch {
    return null;
  }
}

export async function writeLocal(key: string, width: number, body: Buffer): Promise<void> {
  const path = localPath(key, width);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

/** Stores one variant and returns the storage key prefix to save on listing_media. */
export async function putVariant(baseKey: string, width: number, body: Buffer): Promise<string> {
  if (r2Configured()) {
    await r2().send(
      new PutObjectCommand({
        Bucket: env().R2_BUCKET,
        Key: `${baseKey}/${width}.webp`,
        Body: body,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return baseKey;
  }
  const localKey = `local/${baseKey}`;
  await writeLocal(localKey, width, body);
  return localKey;
}
