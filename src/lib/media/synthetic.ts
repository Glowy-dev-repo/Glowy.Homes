import { createHash } from "node:crypto";
import { SCENE_H, SCENE_W, sceneFor } from "./scenes";

// Synthetic listing photos: original illustrations of the home type or the room in the caption,
// labelled as demo images. Never third party images (docs/03 section 1.2). Rendered lazily by /media.

export const SYNTHETIC_PREFIX = "synthetic/";
export const SYNTHETIC_WIDTHS = [400, 800, 1600] as const;
export const SYNTHETIC_ASPECT = 2 / 3;

// Cool, muted tones (slate, steel blue, mist, sky grey, eucalyptus) that sit quietly next to the
// blue and white brand, instead of the full color wheel.
const HUES = [210, 220, 200, 228, 190, 215] as const;

/** Deterministic muted pair for a media source URL. */
export function syntheticPalette(sourceUrl: string): { from: string; to: string } {
  const hash = createHash("md5").update(sourceUrl).digest();
  const hue = HUES[hash[0] % HUES.length] + (hash[1] % 10) - 5;
  const shift = 8 + (hash[2] % 14);
  return { from: hsl(hue, 20, 84), to: hsl((hue + shift) % 360, 18, 64) };
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
export function syntheticPhotoSvg(opts: { sourceUrl: string; width: number; address: string; caption?: string | null; propertyType?: string | null }): string {
  const hash = createHash("md5").update(opts.sourceUrl).digest();
  let i = 0;
  // Deterministic choices per photo, so a listing always renders the same pictures.
  const pick = <T,>(items: readonly T[]): T => items[hash[i++ % hash.length] % items.length];
  const w = opts.width;
  const h = Math.round(w * SYNTHETIC_ASPECT);
  const caption = opts.caption ?? "Front exterior";
  const scene = sceneFor(caption, opts.propertyType ?? "detached", pick, hash[15]);
  const label = `${escapeXml(caption)} · Demo image`;
  const labelW = 40 + label.length * 16.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${SCENE_W} ${SCENE_H}" preserveAspectRatio="xMidYMid slice">
${scene}
<rect x="32" y="${SCENE_H - 88}" width="${labelW}" height="56" rx="28" fill="#0F172A" fill-opacity="0.72"/>
<text x="58" y="${SCENE_H - 50}" font-family="Arial, sans-serif" font-size="28" font-weight="600" fill="#FFFFFF">${label}</text>
</svg>`;
}
