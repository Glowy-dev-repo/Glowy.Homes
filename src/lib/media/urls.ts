// Client safe: builds URLs for processed media variants. Synthetic media is served by the app's
// own /media route; everything else comes from the R2 public bucket (NEXT_PUBLIC_MEDIA_BASE_URL).

/** Bump when the synthetic photo design changes (src/lib/media/synthetic.ts). */
export const SYNTHETIC_STYLE_VERSION = 2;

export const MEDIA_WIDTHS = [400, 800, 1600] as const;

export function snapWidth(width: number): (typeof MEDIA_WIDTHS)[number] {
  return MEDIA_WIDTHS.find((w) => w >= width) ?? 1600;
}

export function mediaUrl(storageKey: string, width: number): string {
  const w = snapWidth(width);
  // Synthetic photos carry a style version, so browsers holding the year long immutable copy refetch after a restyle.
  if (storageKey.startsWith("synthetic/")) return `/media/${storageKey}/${w}.webp?v=${SYNTHETIC_STYLE_VERSION}`;
  if (storageKey.startsWith("local/")) return `/media/${storageKey}/${w}.webp`;
  const base = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/${storageKey}/${w}.webp`;
}
