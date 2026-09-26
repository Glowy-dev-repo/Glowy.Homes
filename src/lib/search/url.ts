import { SearchParams, type SearchParamsInput } from "@/types/search";

// Filters live in the URL (docs/01 S3), so every search is shareable and survives reload.
// Arrays are comma separated; bounds as w,s,e,n; polygon as "lng lat;lng lat;...".

type Raw = URLSearchParams | Record<string, string | string[] | undefined>;

const NUMBER_KEYS = ["priceMin", "priceMax", "bedsMin", "bathsMin", "sqftMin", "sqftMax", "yearBuiltMin", "daysOnMarketMax", "page"] as const;
const STRING_KEYS = ["q", "city", "neighborhood", "keywords", "availableBy", "type", "sort"] as const;
const LIST_KEYS = ["status", "propertyTypes"] as const;
const BOOL_KEYS = ["pets", "furnished"] as const;

function get(raw: Raw, key: string): string | undefined {
  if (raw instanceof URLSearchParams) return raw.get(key) ?? undefined;
  const v = raw[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Builds the loose input object from a query string. Unknown keys are ignored. */
function toInput(raw: Raw): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of STRING_KEYS) {
    const v = get(raw, k);
    if (v) out[k] = v;
  }
  for (const k of NUMBER_KEYS) {
    const v = get(raw, k);
    if (v !== undefined && v !== "" && Number.isFinite(Number(v))) out[k] = Number(v);
  }
  for (const k of LIST_KEYS) {
    const v = get(raw, k);
    if (v) out[k] = v.split(",").filter(Boolean);
  }
  for (const k of BOOL_KEYS) {
    const v = get(raw, k);
    if (v === "true" || v === "1") out[k] = true;
    else if (v === "false" || v === "0") out[k] = false;
  }
  const bounds = get(raw, "bounds");
  if (bounds) out.bounds = bounds.split(",").map(Number);
  const polygon = get(raw, "polygon");
  if (polygon) out.polygon = polygon.split(";").map((pair) => pair.trim().split(/\s+/).map(Number));
  return out;
}

/** Strict parse for API boundaries: invalid input is an error. */
export function parseSearchParamsStrict(raw: Raw) {
  return SearchParams.safeParse(toInput(raw));
}

/**
 * Lenient parse for pages: invalid fields are dropped one by one instead of failing the page,
 * so a stale or hand edited URL still shows results.
 */
export function parseSearchParams(raw: Raw): SearchParams {
  const input = toInput(raw);
  const full = SearchParams.safeParse(input);
  if (full.success) return full.data;
  const bad = new Set(full.error.issues.map((i) => String(i.path[0])));
  for (const key of bad) delete input[key];
  return SearchParams.parse(input);
}

const DEFAULTS = SearchParams.parse({});

const round = (n: number, digits: number) => Number(n.toFixed(digits));

/** Canonical query string. Defaults are omitted so equal searches produce equal URLs (and cache keys). */
export function toQueryString(params: SearchParamsInput): string {
  const p = SearchParams.parse(params);
  const qs = new URLSearchParams();
  if (p.type !== DEFAULTS.type) qs.set("type", p.type);
  if (p.status.join(",") !== DEFAULTS.status.join(",")) qs.set("status", p.status.join(","));
  for (const k of ["q", "city", "neighborhood", "keywords", "availableBy"] as const) if (p[k]) qs.set(k, p[k]!);
  if (p.bounds) qs.set("bounds", p.bounds.map((n) => round(n, 5)).join(","));
  if (p.polygon) qs.set("polygon", p.polygon.map(([x, y]) => `${round(x, 5)} ${round(y, 5)}`).join(";"));
  for (const k of ["priceMin", "priceMax", "bedsMin", "bathsMin", "sqftMin", "sqftMax", "yearBuiltMin", "daysOnMarketMax"] as const) {
    if (p[k] !== undefined) qs.set(k, String(p[k]));
  }
  if (p.propertyTypes?.length) qs.set("propertyTypes", p.propertyTypes.join(","));
  if (p.pets !== undefined) qs.set("pets", String(p.pets));
  if (p.furnished !== undefined) qs.set("furnished", String(p.furnished));
  if (p.sort !== DEFAULTS.sort) qs.set("sort", p.sort);
  if (p.page !== DEFAULTS.page) qs.set("page", String(p.page));
  return qs.toString();
}

/** Number of active filters shown on the mobile Filters badge (location and sort do not count). */
export function activeFilterCount(p: SearchParams): number {
  const keys = ["priceMin", "priceMax", "bedsMin", "bathsMin", "sqftMin", "sqftMax", "yearBuiltMin", "daysOnMarketMax", "keywords", "pets", "furnished", "availableBy"] as const;
  let n = keys.filter((k) => p[k] !== undefined).length;
  if (p.propertyTypes?.length) n++;
  if (p.status.join(",") !== "active") n++;
  return n;
}
