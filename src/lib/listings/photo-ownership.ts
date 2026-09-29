import type { UserListingInput } from "./user-listing-schema";

/**
 * Photos must be this user's own uploads: a storage key in their folder, or (with R2) the public URL
 * of such a key. Anything else would let a listing borrow someone else's photo, or make the server
 * download an arbitrary URL (including internal addresses) when it processes the photo.
 */
/** `mediaBase`: public address of uploaded files when cloud storage is on, otherwise empty (no URL photos). */
export function photosBelongTo(userId: string, photos: UserListingInput["photos"], mediaBase: string): boolean {
  const ownKey = new RegExp(`^(local/)?uploads/${userId}/[0-9a-f-]+$`);
  const ownUrl = `${mediaBase.replace(/\/+$/, "")}/uploads/${userId}/`;
  return photos.every((p) => {
    if (p.storageKey) return ownKey.test(p.storageKey) && !p.sourceUrl;
    return !!mediaBase && !!p.sourceUrl && p.sourceUrl.startsWith(ownUrl) && /^[0-9a-f-]+\.(jpg|png|webp|avif)$/.test(p.sourceUrl.slice(ownUrl.length));
  });
}
