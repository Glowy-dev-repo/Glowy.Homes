/** Version of the partner agreement shown at /pro/agreement; saved with each agent who accepts it. */
export const PARTNER_AGREEMENT_VERSION = "2026-10-draft";

/**
 * California DRE license numbers are 8 digits, often written without the leading zero or with a
 * "DRE#" prefix. Returns the 8 digit form, or null when it cannot be one.
 */
export function normalizeDreLicense(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits.length > 8) return null;
  return digits.padStart(8, "0");
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A stored agreement version ("2026-10-draft") as people read it ("October 2026 draft"). */
export function agreementLabel(version: string | null): string {
  const m = version?.match(/^(\d{4})-(\d{2})(?:-(\w+))?$/);
  if (!m) return version ? version.replace(/-/g, " ") : "not recorded";
  return [MONTHS[Number(m[2]) - 1], m[1], m[3]].filter(Boolean).join(" ");
}
