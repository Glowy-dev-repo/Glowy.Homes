import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { encodeProPhoto, PhotoError, PRO_PHOTO_WIDTHS } from "@/lib/pros/photo";

describe("encodeProPhoto", () => {
  it("makes square WebP photos at each width, without location data", async () => {
    const input = await sharp({ create: { width: 30, height: 20, channels: 3, background: { r: 200, g: 100, b: 50 } } })
      .withMetadata({ exif: { IFD0: { Copyright: "test" }, GPS: { GPSLatitudeRef: "N" } } as never })
      .jpeg()
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const out = await encodeProPhoto(input);
    expect(out.map((o) => o.width)).toEqual([...PRO_PHOTO_WIDTHS]);
    for (const o of out) {
      const meta = await sharp(o.body).metadata();
      expect(meta).toMatchObject({ format: "webp", width: o.width, height: o.width });
      expect(meta.exif).toBeUndefined();
    }
  });

  it("refuses a file that is not an image", async () => {
    await expect(encodeProPhoto(Buffer.from("not a photo, just text"))).rejects.toBeInstanceOf(PhotoError);
  });
});
