/**
 * JSON for a <script type="application/ld+json"> tag. JSON.stringify leaves "<" alone, so a listing
 * description containing "</script>" would close the tag and run what follows; escape it (and the
 * characters that break inline scripts) as unicode escapes, which JSON parsers read back unchanged.
 */
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const UNSAFE = new RegExp(`[<>&${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}]`, "g");

/** Unicode escape of the character: a backslash, "u" and its four digit hex code. */
const escapeChar = (c: string) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`;

export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE, escapeChar);
}
