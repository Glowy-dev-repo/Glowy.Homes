import { mediaUrl } from "./urls";

/**
 * next/image loader (next.config.ts images.loaderFile). `src` is a listing_media storage key;
 * absolute and root relative URLs pass through untouched.
 */
export default function mediaLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  if (src.startsWith("/") || /^https?:\/\//.test(src) || src.startsWith("data:")) return src;
  return mediaUrl(src, width);
}
