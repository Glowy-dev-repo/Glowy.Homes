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
/** JPEG, PNG or WebP by the file's own first bytes, whatever name or type the browser sent. */
export function isAllowedPhoto(input: Buffer): boolean {
  const jpeg = input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
  const png = input.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = input.subarray(0, 4).toString("latin1") === "RIFF" && input.subarray(8, 12).toString("latin1") === "WEBP";
  return jpeg || png || webp;
}

export async function encodeProPhoto(input: Buffer): Promise<{ width: number; body: Buffer }[]> {
  // Checked before sharp sees the file, so other decoders (SVG, TIFF, GIF, HEIF) never run on uploads.
  if (!isAllowedPhoto(input)) throw new PhotoError("not_image");
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
