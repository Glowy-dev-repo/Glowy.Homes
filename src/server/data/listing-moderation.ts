import "server-only";

// Listing moderation decisions (docs/03 section 7) arrive with Phase 5 user listings. Until then a
// listing item cannot reach the queue, so there is nothing to apply.
export async function applyListingDecision(_listingId: string, _decision: "approve" | "reject", _note: string | null): Promise<void> {}
