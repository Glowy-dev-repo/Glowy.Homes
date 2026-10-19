import { NormalizedListingSchema, type ListingFeedAdapter, type NormalizedListing, type RawListing } from "../types";
import type { PropertyType } from "@/db/schema/listings";

// SimplyRETS (https://api.simplyrets.com): a REST API over the MLS IDX feed, licensed per MLS. Our
// site keeps its own copy (docs/03 section 1.3): pages of up to 500 listings ordered by id (lastId),
// limited to listings modified since the last run. Photos stay on SimplyRETS's CDN and are shown as is.
//
// Never stored: privateRemarks, showingInstructions, showingContact*, agreement and ownership. They are
// agent only MLS fields that IDX rules keep off public sites (CSMAR Rule 12.16.4).

const BASE = "https://api.simplyrets.com";
// Every status, so a listing that sells, expires or is withdrawn reaches us and leaves the site.
const STATUSES = ["Active", "ActiveUnderContract", "Pending", "Hold", "Withdrawn", "Closed", "Expired", "Delete", "Incomplete", "ComingSoon", "Cancelled"];
const MAX_PAGE = 500;
// Neutral 1x1 placeholder: the photos are not processed, so there is no blurred preview to show.
const NEUTRAL_BLUR = "data:image/gif;base64,R0lGODlhAQABAIAAAOLo8AAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";

type Contact = { office?: string | null; cell?: string | null; email?: string | null } | null;
type Person = { firstName?: string | null; lastName?: string | null; id?: string | null; contact?: Contact } | null;

/** The fields we read from a SimplyRETS property. Anything else in the record is ignored. */
export type SimplyRetsProperty = {
  mlsId: number;
  listingId?: string | null;
  modified?: string | null;
  listDate?: string | null;
  listPrice?: number | null;
  originalListPrice?: number | null;
  remarks?: string | null;
  virtualTourUrl?: string | null;
  photos?: string[] | null;
  internetEntireListingDisplay?: boolean | null;
  internetAddressDisplay?: boolean | null;
  address?: { full?: string | null; streetNumberText?: string | null; streetName?: string | null; unit?: string | null; city?: string | null; state?: string | null; postalCode?: string | null } | null;
  geo?: { lat?: number | null; lng?: number | null } | null;
  mls?: { status?: string | null; daysOnMarket?: number | null; area?: string | null } | null;
  property?: {
    type?: string | null;
    subType?: string | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    bathsFull?: number | null;
    bathsHalf?: number | null;
    bathsThreeQuarter?: number | null;
    area?: number | null;
    lotSizeArea?: number | null;
    lotSizeAreaUnits?: string | null;
    acres?: number | null;
    yearBuilt?: number | null;
    stories?: number | null;
    garageSpaces?: number | null;
    parking?: { spaces?: number | null } | null;
    interiorFeatures?: string | null;
    exteriorFeatures?: string | null;
    laundryFeatures?: string | null;
    heating?: string | null;
    cooling?: string | null;
    pool?: string | null;
    view?: string | null;
    roof?: string | null;
    foundation?: string | null;
    style?: string | null;
    subdivision?: string | null;
    fireplaces?: number | null;
  } | null;
  association?: { fee?: number | null; amenities?: string | null } | null;
  tax?: { taxAnnualAmount?: number | null } | null;
  school?: { district?: string | null; elementarySchool?: string | null; middleSchool?: string | null; highSchool?: string | null } | null;
  agent?: Person;
  coAgent?: Person;
  office?: { name?: string | null; servingName?: string | null; contact?: Contact } | null;
  sales?: { closePrice?: number | null; closeDate?: string | null } | null;
  leaseTerm?: string | null;
};

const STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};

export function stateCode(state: string | null | undefined): string {
  const s = (state ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  return STATES[s.toLowerCase()] ?? "CA";
}

export function mapStatus(status: string | null | undefined, rent: boolean): NormalizedListing["status"] {
  switch (status) {
    case "Active":
      return "active";
    case "ActiveUnderContract":
    case "Pending":
      return "pending";
    case "Closed":
      return rent ? "leased" : "sold";
    case "Expired":
      return "expired";
    // Coming soon, on hold, incomplete, cancelled and deleted listings are not shown.
    default:
      return "withdrawn";
  }
}

export function mapPropertyType(type: string | null | undefined, subType: string | null | undefined): PropertyType {
  const sub = (subType ?? "").toLowerCase();
  if (/condo|apartment|stock ?cooperative/.test(sub)) return "condo";
  if (/town ?house|townhome|row ?house/.test(sub)) return "townhouse";
  if (/duplex|triplex|quadruplex|multi/.test(sub)) return "multi";
  if (/semi|twin/.test(sub)) return "semi";
  if (/single ?family|detached|manufactured|mobile/.test(sub)) return "detached";
  switch (type) {
    case "CND":
      return "condo";
    case "MLF":
      return "multi";
    case "LND":
      return "land";
    case "RES":
    case "RNT":
      return "detached";
    default:
      return "other";
  }
}

const isoDate = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : undefined);
const posInt = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : undefined);
const list = (v: string | null | undefined) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30) : []);
const name = (p: Person | undefined) => [p?.firstName, p?.lastName].map((s) => s?.trim()).filter(Boolean).join(" ") || undefined;
const httpsUrl = (u: string | null | undefined) => (u && /^https:\/\/[^\s]+$/i.test(u) ? u : undefined);

export function normalizeSimplyRets(p: SimplyRetsProperty): NormalizedListing {
  const rent = p.property?.type === "RNT";
  const pr = p.property ?? {};
  const baths =
    typeof pr.bathrooms === "number" && pr.bathrooms > 0
      ? pr.bathrooms
      : (pr.bathsFull ?? 0) + 0.5 * (pr.bathsHalf ?? 0) + 0.75 * (pr.bathsThreeQuarter ?? 0) || undefined;
  const lot =
    pr.lotSizeArea && /acre/i.test(pr.lotSizeAreaUnits ?? "") ? pr.lotSizeArea * 43_560 : pr.lotSizeArea ?? (pr.acres ? pr.acres * 43_560 : undefined);
  const year = pr.yearBuilt && pr.yearBuilt >= 1800 && pr.yearBuilt <= 2100 ? pr.yearBuilt : undefined;
  const lat = p.geo?.lat;
  const lng = p.geo?.lng;
  const line1 =
    p.address?.full?.trim() || [p.address?.streetNumberText, p.address?.streetName].filter(Boolean).join(" ").trim();
  const modified = p.modified ?? p.listDate ?? new Date(0).toISOString();
  const listDate = isoDate(p.listDate) ?? isoDate(modified)!;
  const status = mapStatus(p.mls?.status, rent);
  const soldDate = isoDate(p.sales?.closeDate);

  const record = {
    sourceListingId: (p.listingId ?? "").trim() || String(p.mlsId),
    sourceUpdatedAt: new Date(modified).toISOString(),
    listingType: rent ? "rent" : "sale",
    status,
    price: posInt(p.listPrice) ?? 0,
    originalPrice: posInt(p.originalListPrice),
    soldPrice: status === "sold" ? posInt(p.sales?.closePrice) : undefined,
    listDate,
    statusDate: (status === "sold" || status === "leased") && soldDate ? soldDate : (isoDate(modified) ?? listDate),
    soldDate: status === "sold" ? soldDate : undefined,
    address: {
      line1,
      city: p.address?.city?.trim() ?? "",
      regionCode: stateCode(p.address?.state),
      postalCode: (p.address?.postalCode ?? "").trim(),
      country: "US",
    },
    location: typeof lat === "number" && typeof lng === "number" && (lat !== 0 || lng !== 0) ? { lat, lng } : undefined,
    propertyType: mapPropertyType(pr.type, pr.subType),
    beds: typeof pr.bedrooms === "number" ? Math.min(pr.bedrooms, 20) : undefined,
    baths: typeof baths === "number" ? Math.min(baths, 20) : undefined,
    sqft: posInt(pr.area),
    lotSqft: posInt(lot),
    yearBuilt: year,
    stories: posInt(pr.stories),
    parkingSpaces: posInt(pr.parking?.spaces ?? pr.garageSpaces),
    facts: Object.fromEntries(
      Object.entries({
        mls_number: p.listingId ?? null,
        simplyrets_id: p.mlsId,
        subdivision: pr.subdivision,
        style: pr.style,
        heating: pr.heating,
        cooling: pr.cooling,
        pool: pr.pool,
        view: pr.view,
        roof: pr.roof,
        foundation: pr.foundation,
        fireplaces: pr.fireplaces,
        laundry: pr.laundryFeatures,
        school_district: p.school?.district,
        elementary_school: p.school?.elementarySchool,
        middle_school: p.school?.middleSchool,
        high_school: p.school?.highSchool,
      })
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        // Feed lists arrive as "A,B,C"; show them as "A, B, C".
        .map(([k, v]) => [k, typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean).join(", ") : v]),
    ),
    features: {
      interior: list(pr.interiorFeatures),
      exterior: list(pr.exteriorFeatures),
      building: [pr.roof, pr.foundation, pr.style].filter((v): v is string => !!v),
      community: list(p.association?.amenities),
    },
    rentalTerms: rent ? {} : undefined,
    description: p.remarks?.trim() || undefined,
    hoaFee: typeof p.association?.fee === "number" && p.association.fee >= 0 ? Math.round(p.association.fee) : undefined,
    taxAnnual: typeof p.tax?.taxAnnualAmount === "number" && p.tax.taxAnnualAmount >= 0 ? Math.round(p.tax.taxAnnualAmount) : undefined,
    virtualTourUrl: httpsUrl(p.virtualTourUrl),
    media: (p.photos ?? [])
      .map(httpsUrl)
      .filter((u): u is string => !!u)
      .slice(0, 60)
      .map((url, position) => ({ url, kind: "photo" as const, position })),
    agent: {
      name: name(p.agent) ?? "Listing agent",
      email: p.agent?.contact?.email ?? undefined,
      phone: p.agent?.contact?.office ?? p.agent?.contact?.cell ?? undefined,
      brokerage: p.office?.name?.trim() || p.office?.servingName?.trim() || "Listing office",
      officePhone: p.office?.contact?.office ?? undefined,
      coAgentName: name(p.coAgent),
    },
    display: {
      internet: p.internetEntireListingDisplay === false ? false : undefined,
      address: p.internetAddressDisplay === false ? false : undefined,
    },
  };
  return NormalizedListingSchema.parse(record);
}

/** Origins photos may come from (Content-Security-Policy img-src): the feed's CDN. */
export function feedPhotoOrigins(): string[] {
  return (process.env.FEED_PHOTO_ORIGINS ?? "https://d2bd5h5te3s67r.cloudfront.net")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^https:\/\/[a-z0-9.-]+$/i.test(s));
}

export function simplyRetsAdapter(opts: { key: string; secret: string; fetchImpl?: typeof fetch; baseUrl?: string }): ListingFeedAdapter & {
  inlineMedia(url: string): { storageKey: string; blurDataUrl: string; width: number; height: number } | null;
} {
  const base = (opts.baseUrl ?? BASE).replace(/\/+$/, "");
  const auth = `Basic ${Buffer.from(`${opts.key}:${opts.secret}`).toString("base64")}`;
  const doFetch = opts.fetchImpl ?? fetch;
  const origins = feedPhotoOrigins();

  return {
    source: "simplyrets",

    async *fetchChanged(cursor, pageSize) {
      const limit = Math.min(Math.max(pageSize, 1), MAX_PAGE);
      let lastId = 0;
      for (let page = 0; page < 10_000; page++) {
        const qs = new URLSearchParams({ limit: String(limit), lastId: String(lastId) });
        for (const s of STATUSES) qs.append("status", s);
        if (cursor) qs.set("modified", cursor);
        const res = await doFetch(`${base}/properties?${qs}`, {
          headers: { Authorization: auth, Accept: "application/json" },
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) throw new Error(`SimplyRETS ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const items = (await res.json()) as RawListing[];
        if (!items.length) return;
        let maxModified: string | null = cursor;
        for (const it of items) {
          const m = typeof it.modified === "string" ? new Date(it.modified).toISOString() : null;
          if (m && (!maxModified || m > maxModified)) maxModified = m;
        }
        yield { items, nextCursor: maxModified };
        if (items.length < limit) return;
        lastId = Number(items[items.length - 1].mlsId);
        if (!Number.isFinite(lastId)) return;
      }
    },

    normalize(raw) {
      return normalizeSimplyRets(raw as unknown as SimplyRetsProperty);
    },

    /** Photos are served from the feed's CDN; only CDNs listed in FEED_PHOTO_ORIGINS are used. */
    inlineMedia(url) {
      if (!origins.some((o) => url.startsWith(`${o}/`))) return null;
      return { storageKey: url, blurDataUrl: NEUTRAL_BLUR, width: 1600, height: 1067 };
    },
  };
}
