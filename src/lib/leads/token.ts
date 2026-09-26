import { createHmac, timingSafeEqual } from "node:crypto";

// A lead's status token lets the person who submitted a form (possibly signed out) see who it was
// assigned to, and nobody else (docs/05 Phase 4 criterion 5).

const secret = () => process.env.AUTH_SECRET ?? "dev-secret";

export function leadViewToken(leadId: string): string {
  return createHmac("sha256", secret()).update(`lead:${leadId}`).digest("base64url").slice(0, 32);
}

export function verifyLeadViewToken(leadId: string, token: string | null): boolean {
  if (!token) return false;
  const expected = Buffer.from(leadViewToken(leadId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
