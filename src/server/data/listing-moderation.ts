import "server-only";
import { applyUserListingDecision } from "./user-listings";

/** Listing moderation decisions (docs/03 section 7). */
export async function applyListingDecision(listingId: string, decision: "approve" | "reject", note: string | null): Promise<void> {
  await applyUserListingDecision(listingId, decision, note);
}
