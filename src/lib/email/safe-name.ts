/**
 * A person's typed name, made safe to put in an email we send to someone else. People can type
 * anything into a name field, so links, web addresses, email addresses and long numbers (phone numbers)
 * are removed: our emails must not carry a stranger's "visit this site" or "call this number" message.
 */
export function nameForEmail(raw: string | null | undefined, fallback = "Someone"): string {
  const cleaned = (raw ?? "")
    .replace(/\b(?:https?:\/\/|www\.)\S*/gi, " ")
    .replace(/\S+@\S+/g, " ")
    .replace(/\b[\w-]+(?:\.[\w-]+)+\b/g, " ")
    .replace(/[+(]?\d[\d\s().-]{4,}\d/g, " ")
    .replace(/[^\p{L}\p{M}' .-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
    .trim();
  return cleaned.length >= 2 ? cleaned : fallback;
}
