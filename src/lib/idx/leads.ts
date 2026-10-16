// Turns an IDX Broker lead (someone who registered on the hosted listing search) into one of our
// leads, so it can be routed to the partner agent for the ZIP code of the homes they care about.
// IDX Broker's saved property and recently viewed shapes are not fully documented, so the ZIP code,
// price and address are found by field name anywhere in those records, most specific source first.

export type IdxLead = {
  id: string | number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  zipCode?: string | null;
  disabled?: string | null;
  blacklisted?: string | null;
  subscribeDate?: string | null;
  recentlyViewedListings?: unknown;
};

export type ZipSource = "saved_home" | "viewed_home" | "lead_address";

export type IdxLeadInput = {
  externalRef: string;
  idxLeadId: string;
  name: string;
  email: string;
  phone: string | null;
  zip: string | null;
  zipSource: ZipSource | null;
  address: string | null;
  price: number | null;
  message: string;
};

const ZIP_KEY = /^(zip|zipcode|zip_code|postalcode|postal_code)$/i;
const PRICE_KEY = /^(listingprice|listprice|list_price|price|currentprice)$/i;
const ADDRESS_KEY = /^(propertyname|address|fulladdress|full_address|streetaddress)$/i;
// "..., Moorpark, CA 93021" in an address, or "-Moorpark-CA-93021" in a listing page URL.
const ZIP_IN_TEXT = /(?:\bCA|-CA)[\s,-]+(\d{5})(?:-\d{4})?\b/i;

function walk(value: unknown, visit: (key: string, v: unknown) => boolean, depth = 0): boolean {
  if (depth > 5 || value === null || typeof value !== "object") return false;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (visit(k, v)) return true;
    if (walk(v, visit, depth + 1)) return true;
  }
  return false;
}

export function findZip(value: unknown): string | null {
  let zip: string | null = null;
  walk(value, (k, v) => {
    if (ZIP_KEY.test(k) && (typeof v === "string" || typeof v === "number")) {
      const m = String(v).trim().match(/^(\d{5})(?:-\d{4})?$/);
      if (m) zip = m[1];
    } else if (typeof v === "string") {
      const m = v.match(ZIP_IN_TEXT);
      if (m) zip = m[1];
    }
    return zip !== null;
  });
  return zip;
}

export function findPrice(value: unknown): number | null {
  let price: number | null = null;
  walk(value, (k, v) => {
    if (!PRICE_KEY.test(k)) return false;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[$,\s]/g, "")) : NaN;
    if (Number.isFinite(n) && n > 0) price = Math.round(n);
    return price !== null;
  });
  return price;
}

export function findAddress(value: unknown): string | null {
  let address: string | null = null;
  walk(value, (k, v) => {
    if (ADDRESS_KEY.test(k) && typeof v === "string" && v.trim()) address = v.trim().slice(0, 200);
    return address !== null;
  });
  return address;
}

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);

/** Null when the lead cannot or should not be contacted (no email, disabled or blocked in IDX Broker). */
export function idxLeadToInput(lead: IdxLead, savedProperties: unknown): IdxLeadInput | null {
  const email = lead.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (lead.disabled === "y" || lead.blacklisted === "y") return null;

  const saved = asList(savedProperties);
  const viewed = asList(lead.recentlyViewedListings);
  let zip: string | null = null;
  let zipSource: ZipSource | null = null;
  let home: unknown = null;
  for (const [source, items] of [["saved_home", saved], ["viewed_home", viewed]] as const) {
    for (const item of items) {
      const z = findZip(item);
      if (z) {
        zip = z;
        zipSource = source;
        home = item;
        break;
      }
    }
    if (zip) break;
  }
  if (!zip) {
    const own = lead.zipCode?.trim().match(/^(\d{5})/)?.[1] ?? null;
    if (own) {
      zip = own;
      zipSource = "lead_address";
    }
  }

  const name = [lead.firstName, lead.lastName].map((s) => s?.trim()).filter(Boolean).join(" ").slice(0, 80) || email.split("@")[0];
  const digits = lead.phone?.replace(/[^\d+]/g, "") ?? "";
  const address = home ? findAddress(home) : null;
  const parts = ["Registered on the Glowy Homes listing search."];
  if (saved.length) parts.push(`Saved ${saved.length} ${saved.length === 1 ? "home" : "homes"}.`);
  if (address) parts.push(`Interested in ${address}.`);
  if (zipSource === "lead_address") parts.push("No saved or viewed home yet; matched by the ZIP code they entered.");

  return {
    externalRef: `idx:${lead.id}`,
    idxLeadId: String(lead.id),
    name,
    email,
    phone: /^\+?\d{10,15}$/.test(digits) ? digits : null,
    zip,
    zipSource,
    address,
    price: home ? findPrice(home) : null,
    message: parts.join(" "),
  };
}
