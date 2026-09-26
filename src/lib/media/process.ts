import "server-only";
import type postgres from "postgres";
import sharp from "sharp";
import { putVariant } from "./storage";
import { syntheticPhotoSvg } from "./synthetic";
import { MEDIA_WIDTHS } from "./urls";

// process_media (docs/03 section 2).

const DOWNLOAD_TIMEOUT_MS = 10_000;
const MAX_BYTES = 15 * 1024 * 1024;

export async function downloadImage(url: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok || !res.body) throw new Error(`Download failed with status ${res.status}`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new Error("Image larger than 15 MB");
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("Image larger than 15 MB");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Auto orients, strips metadata (sharp drops it unless asked to keep it) and encodes WebP variants. */
export async function encodeVariants(input: Buffer) {
  const base = sharp(input, { failOn: "error" }).rotate();
  const meta = await base.metadata();
  const variants = await Promise.all(
    MEDIA_WIDTHS.map(async (width) => ({
      width,
      body: await base.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
    })),
  );
  const blur = await base.clone().resize(16).png().toBuffer();
  const oriented = meta.orientation && meta.orientation >= 5;
  return {
    variants,
    width: (oriented ? meta.height : meta.width) ?? null,
    height: (oriented ? meta.width : meta.height) ?? null,
    blurDataUrl: `data:image/png;base64,${blur.toString("base64")}`,
  };
}

export async function renderSynthetic(opts: { sourceUrl: string; address: string; caption?: string | null; width: number }) {
  const svg = syntheticPhotoSvg(opts);
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}

type MediaRow = { id: string; listing_id: string; source_url: string | null; caption: string | null; address: string };

export async function processMedia(sql: postgres.Sql, mediaId: string, fetchImpl: typeof fetch = fetch) {
  const [row] = await sql<MediaRow[]>`
    select m.id, m.listing_id, m.source_url, m.caption,
      concat_ws(', ', concat_ws(' ', p.address_line2, p.address_line1), p.city) as address
    from listing_media m join listings l on l.id = m.listing_id join properties p on p.id = l.property_id
    where m.id = ${mediaId}`;
  if (!row?.source_url) return { skipped: true as const };

  const input = row.source_url.startsWith("synthetic://")
    ? await renderSynthetic({ sourceUrl: row.source_url, address: row.address, caption: row.caption, width: 1600 })
    : await downloadImage(row.source_url, fetchImpl);

  const encoded = await encodeVariants(input);
  const baseKey = `listings/${row.listing_id}/${row.id}`;
  let storageKey = baseKey;
  for (const v of encoded.variants) storageKey = await putVariant(baseKey, v.width, v.body);

  await sql`
    update listing_media set storage_key = ${storageKey}, width = ${encoded.width}, height = ${encoded.height},
      blur_data_url = ${encoded.blurDataUrl}, processed_at = now()
    where id = ${row.id}`;
  return { skipped: false as const, storageKey };
}
