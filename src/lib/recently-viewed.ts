import type { ListingSummary } from "@/types/search";

// Recently viewed homes (docs/01 S7): local storage for signed out visitors. Stores a card
// snapshot so the list renders without a request.

const KEY = "gh:recently-viewed";
const MAX = 12;
const EVENT = "gh:recently-viewed-change";

export type RecentItem = Pick<
  ListingSummary,
  "id" | "listingType" | "status" | "price" | "soldPrice" | "beds" | "baths" | "sqft" | "propertyType" | "listDate" | "statusDate" | "isFeatured" | "brokerageName" | "addressLine1" | "addressLine2" | "city" | "lat" | "lng" | "coverKey" | "coverBlur"
> & { viewedAt: number };

export function readRecentlyViewed(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as RecentItem[]).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function recordRecentlyViewed(listing: ListingSummary) {
  if (typeof window === "undefined") return;
  const items = readRecentlyViewed().filter((i) => i.id !== listing.id);
  items.unshift({ ...listing, viewedAt: Date.now() });
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage full or disabled: recently viewed is a convenience, so fail quietly.
  }
}

export function subscribeRecentlyViewed(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
