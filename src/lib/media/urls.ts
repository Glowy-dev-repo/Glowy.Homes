// Client safe: builds URLs for processed media variants. Synthetic media is served by the app's
// own /media route; everything else comes from the R2 public bucket (NEXT_PUBLIC_MEDIA_BASE_URL).

export const MEDIA_WIDTHS = [400, 800, 1600] as const;

export function snapWidth(width: number): (typeof MEDIA_WIDTHS)[number] {
  return MEDIA_WIDTHS.find((w) => w >= width) ?? 1600;
}

export function mediaUrl(storageKey: string, width: number): string {
  const w = snapWidth(width);
  if (storageKey.startsWith("synthetic/") || storageKey.startsWith("local/")) return `/media/${storageKey}/${w}.webp`;
  const base = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/${storageKey}/${w}.webp`;
}
