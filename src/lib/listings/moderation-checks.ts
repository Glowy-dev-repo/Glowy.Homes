// Automatic moderation checks for user submitted listings (docs/03 section 7, docs/06 fair housing).
// Pure, so they run in the browser for instant feedback and on the server as the real gate.

export const MIN_PHOTOS = 3;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const URL = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|ca|net|org|io|co)\b/i;
// Protected grounds under the Ontario Human Rights Code; listings may not exclude people on them.
const FAIR_HOUSING = [
  /\bno (?:kids|children|families)\b/i,
  /\badults? only\b/i,
  /\b(?:christians?|muslims?|jewish|hindus?|sikhs?) only\b/i,
  /\bno (?:immigrants|newcomers|foreigners|students on social assistance|welfare|odsp)\b/i,
  /\b(?:perfect for|ideal for|suits) (?:a )?(?:single|married|young) (?:man|woman|couple|professional)s?\b/i,
  /\bno (?:disabled|wheelchairs?)\b/i,
];

export type CheckInput = {
  photoCount: number;
  price: number;
  estimate: number | null;
  description: string;
  hasLocation: boolean;
};

export type CheckResult = { passed: boolean; failed: string[] };

export function contactInfoIn(text: string): boolean {
  return EMAIL.test(text) || PHONE.test(text) || URL.test(text);
}

export function fairHousingIssue(text: string): boolean {
  return FAIR_HOUSING.some((re) => re.test(text));
}

export function runListingChecks(input: CheckInput): CheckResult {
  const failed: string[] = [];
  if (input.photoCount < MIN_PHOTOS) failed.push(`fewer than ${MIN_PHOTOS} photos`);
  if (input.estimate && (input.price < input.estimate * 0.3 || input.price > input.estimate * 3)) failed.push("price far from the estimate");
  if (contactInfoIn(input.description)) failed.push("contact details or links in the description");
  if (fairHousingIssue(input.description)) failed.push("fair housing language");
  if (!input.hasLocation) failed.push("address did not geocode");
  return { passed: failed.length === 0, failed };
}
