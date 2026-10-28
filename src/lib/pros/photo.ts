import sharp, { type Sharp } from "sharp";

export { MAX_PHOTO_BYTES, PHOTO_TYPES } from "./photo-limits";
/** Stored widths: 400 for the profile, 800 for sharp screens (lib/media/urls.ts snaps to these). */
export const PRO_PHOTO_WIDTHS = [400, 800] as const;

export class PhotoError extends Error {
  constructor(readonly code: "not_image" | "too_large" | "wrong_type") {
    super(code);
  }
}

/**
 * Agent headshot: decoded (so anything that is not really an image fails here), turned upright, cropped
 * square and re-encoded as WebP. sharp drops all metadata unless asked to keep it, so GPS and camera
 * EXIF never reach the public profile.
 */
export async function encodeProPhoto(input: Buffer): Promise<{ width: number; body: Buffer }[]> {
  let image: Sharp;
  try {
    image = sharp(input, { limitInputPixels: 40_000_000 }).rotate();
    await image.metadata();
  } catch {
    throw new PhotoError("not_image");
  }
  try {
    return await Promise.all(
      PRO_PHOTO_WIDTHS.map(async (width) => ({ width, body: await image.clone().resize(width, width, { fit: "cover" }).webp({ quality: 82 }).toBuffer() })),
    );
  } catch {
    throw new PhotoError("not_image");
  }
}
