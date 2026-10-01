import sharp from "sharp";
import { sqlClient } from "@/db";
import { renderSynthetic } from "@/lib/media/process";
import { syntheticPhotoSvg } from "@/lib/media/synthetic";
import { readLocal, writeLocal } from "@/lib/media/storage";
import { MEDIA_WIDTHS } from "@/lib/media/urls";

// Serves media that does not live on the CDN:
//   /media/synthetic/{sourceListingId}/{n}/photo.svg     demo photo as SVG, drawn by the browser
//   /media/synthetic/{sourceListingId}/{n}/{width}.webp  older raster form, rendered on first request, then cached
//   /media/local/{key}/{width}.webp                      processed uploads when R2 is not configured

const IMMUTABLE = { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" };

// Our own generated markup (address and caption are XML escaped); the policy still forbids scripts and
// loading anything, in case the file is opened directly rather than as an image.
const SVG_HEADERS = {
  "Content-Type": "image/svg+xml",
  "Cache-Control": "public, max-age=31536000, immutable",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
};

async function syntheticRow(sourceListingId: string, sourceUrl: string) {
  const [row] = await sqlClient<{ address: string; caption: string | null; propertyType: string }[]>`
    select concat_ws(', ', concat_ws(' ', p.address_line2, p.address_line1), p.city) as address, m.caption, l.property_type as "propertyType"
    from listings l
    join properties p on p.id = l.property_id
    left join listing_media m on m.listing_id = l.id and m.source_url = ${sourceUrl}
    where l.source = 'synthetic' and l.source_listing_id = ${sourceListingId}
    limit 1`;
  return row ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const file = path.at(-1) ?? "";
  if (file === "photo.svg") {
    const synthetic = path.slice(0, -1).join("/").match(/^synthetic\/([A-Za-z0-9]{1,20})\/(\d{1,3})$/);
    if (!synthetic) return new Response("Not found", { status: 404 });
    const sourceUrl = `synthetic://${synthetic[1]}/${synthetic[2]}`;
    const row = await syntheticRow(synthetic[1], sourceUrl);
    if (!row) return new Response("Not found", { status: 404 });
    const svg = syntheticPhotoSvg({ sourceUrl, address: row.address, caption: row.caption, propertyType: row.propertyType, width: 1600 });
    return new Response(svg, { headers: SVG_HEADERS });
  }
  const width = Number(file.replace(/\.webp$/, ""));
  if (!MEDIA_WIDTHS.includes(width as (typeof MEDIA_WIDTHS)[number])) return new Response("Not found", { status: 404 });
  const key = path.slice(0, -1).join("/");

  const cached = await readLocal(key, width).catch(() => null);
  if (cached) return new Response(new Uint8Array(cached), { headers: IMMUTABLE });

  const synthetic = key.match(/^synthetic\/([A-Za-z0-9]{1,20})\/(\d{1,3})$/);
  if (!synthetic) return new Response("Not found", { status: 404 });

  const sourceUrl = `synthetic://${synthetic[1]}/${synthetic[2]}`;
  const row = await syntheticRow(synthetic[1], sourceUrl);
  if (!row) return new Response("Not found", { status: 404 });

  const full = await renderSynthetic({ sourceUrl, address: row.address, caption: row.caption, propertyType: row.propertyType, width: 1600 });
  const body = width === 1600 ? full : await sharp(full).resize({ width }).webp({ quality: 78 }).toBuffer();
  await writeLocal(key, width, body).catch(() => {});
  return new Response(new Uint8Array(body), { headers: IMMUTABLE });
}
