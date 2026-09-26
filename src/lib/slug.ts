export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** URL slug for a listing or property address: "12 Maple Ave, Unit 4, Oakville" -> "12-maple-ave-unit-4-oakville". */
export function addressSlug(line1: string, line2: string | null | undefined, city: string): string {
  return slugify([line1, line2, city].filter(Boolean).join(" "));
}
