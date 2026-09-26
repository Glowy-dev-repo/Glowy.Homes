import { createHash } from "node:crypto";

// Synthetic listing photos: soft two tone gradients with the address baked in. Never third
// party images (docs/03 section 1.2). Rendered lazily by /media on first request.

export const SYNTHETIC_PREFIX = "synthetic/";
export const SYNTHETIC_WIDTHS = [400, 800, 1600] as const;
export const SYNTHETIC_ASPECT = 2 / 3;

/** Deterministic pastel pair for a media source URL. */
export function syntheticPalette(sourceUrl: string): { from: string; to: string } {
  const hash = createHash("md5").update(sourceUrl).digest();
  const hue = (hash[0] * 256 + hash[1]) % 360;
  const shift = 20 + (hash[2] % 40);
  return { from: hsl(hue, 45, 78), to: hsl((hue + shift) % 360, 50, 62) };
}

function hsl(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Tiny SVG gradient as a data URL, used as the next/image blur placeholder. */
export function syntheticBlurDataUrl(sourceUrl: string): string {
  const { from, to } = syntheticPalette(sourceUrl);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="11"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="16" height="11" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** "synthetic://GH0000001/3" -> "synthetic/GH0000001/3" */
export function syntheticStorageKey(sourceUrl: string): string | null {
  const m = sourceUrl.match(/^synthetic:\/\/([A-Za-z0-9]+)\/(\d+)$/);
  return m ? `${SYNTHETIC_PREFIX}${m[1]}/${m[2]}` : null;
}

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/** SVG source for a synthetic photo at a given width; sharp rasterizes it to WebP. */
export function syntheticPhotoSvg(opts: { sourceUrl: string; width: number; address: string; caption?: string | null }): string {
  const { from, to } = syntheticPalette(opts.sourceUrl);
  const w = opts.width;
  const h = Math.round(w * SYNTHETIC_ASPECT);
  const size = Math.max(14, Math.round(w / 28));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect x="${w * 0.3}" y="${h * 0.38}" width="${w * 0.4}" height="${h * 0.34}" fill="#ffffff" fill-opacity="0.35"/>
  <polygon points="${w * 0.26},${h * 0.4} ${w * 0.5},${h * 0.2} ${w * 0.74},${h * 0.4}" fill="#ffffff" fill-opacity="0.45"/>
  <text x="${size}" y="${h - size * 2.2}" font-family="Arial, sans-serif" font-size="${size}" font-weight="600" fill="#18181b">${escapeXml(opts.address)}</text>
  <text x="${size}" y="${h - size * 0.9}" font-family="Arial, sans-serif" font-size="${Math.round(size * 0.8)}" fill="#27272a">${escapeXml(opts.caption ?? "Photo")} · Synthetic image</text>
</svg>`;
}
