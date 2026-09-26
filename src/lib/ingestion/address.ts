// Address normalization for dedupe (docs/03 section 1.3 step b): uppercase, strip punctuation,
// expand abbreviations, and fold unit designators into one form.

const ABBREVIATIONS: Record<string, string> = {
  ST: "STREET",
  AVE: "AVENUE",
  AV: "AVENUE",
  RD: "ROAD",
  DR: "DRIVE",
  CRES: "CRESCENT",
  CR: "CRESCENT",
  BLVD: "BOULEVARD",
  CRT: "COURT",
  CT: "COURT",
  PL: "PLACE",
  LN: "LANE",
  TER: "TERRACE",
  TERR: "TERRACE",
  PKWY: "PARKWAY",
  HWY: "HIGHWAY",
  SQ: "SQUARE",
  CIR: "CIRCLE",
  GDNS: "GARDENS",
  HTS: "HEIGHTS",
  N: "NORTH",
  S: "SOUTH",
  E: "EAST",
  W: "WEST",
  MT: "MOUNT",
};

const UNIT_WORDS = /\b(UNIT|APT|APARTMENT|SUITE|STE|PH|PENTHOUSE)\b\.?/g;

function clean(value: string): string {
  return value
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/#/g, " UNIT ")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeStreet(line1: string): string {
  return clean(line1)
    .split(" ")
    .map((w) => ABBREVIATIONS[w] ?? w)
    .join(" ");
}

export function normalizeUnit(line2: string | null | undefined): string | null {
  if (!line2) return null;
  const unit = clean(line2).replace(UNIT_WORDS, " ").replace(/\s+/g, " ").trim();
  return unit ? `UNIT ${unit}` : null;
}

/** "12 Maple Ave." + "Apt #4" -> "12 MAPLE AVENUE UNIT 4" */
export function normalizeAddress(line1: string, line2?: string | null): string {
  return [normalizeStreet(line1), normalizeUnit(line2)].filter(Boolean).join(" ");
}

/** Canadian postal codes as "A1A 1A1", US ZIP codes as "94110" or "94110-1234"; others uppercased and trimmed. */
export function normalizePostalCode(postal: string): string {
  const compact = postal.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)) return `${compact.slice(0, 3)} ${compact.slice(3)}`;
  if (/^\d{9}$/.test(compact)) return `${compact.slice(0, 5)}-${compact.slice(5)}`;
  return postal.toUpperCase().trim();
}
