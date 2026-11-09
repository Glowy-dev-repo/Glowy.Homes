import { brand } from "@/config/brand";
import { NormalizedListingSchema, type ListingFeedAdapter, type NormalizedListing, type RawListing } from "../types";
import { feedPhotoOrigins, mapPropertyType, mapStatus, stateCode } from "./simplyrets";

// Spark API (https://sparkapi.com, FBS): how CSMAR licenses its Consultant IDX feed through the Spark
// Datamart. Like SimplyRETS, our site keeps its own copy (docs/03 section 1.3): listings modified since
// the last run, in pages ordered by ListingKey so a listing changing mid run cannot shift the pages.
// Photos stay on Spark's CDN and are shown as is.
//
// Never stored: PrivateRemarks, showing details and buyer side fields. They are agent only MLS fields
// that IDX rules keep off public sites (CSMAR Rule 12.16.4). Fields the key may not see arrive as
// "********" and are treated as missing.

const BASE = "https://sparkapi.com";
// Standard keys return at most 25 listings a page; replication keys allow 1000 (SPARK_PAGE_SIZE).
const DEFAULT_PAGE = 25;
const MAX_PAGE = 1000;
const MASKED = "********";
// Neutral 1x1 placeholder: the photos are not processed, so there is no blurred preview to show.
const NEUTRAL_BLUR = "data:image/gif;base64,R0lGODlhAQABAIAAAOLo8AAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";

type SparkPhoto = {
  Primary?: boolean | null;
  Privacy?: string | null;
  Caption?: string | null;
  Uri640?: string | null;
  Uri800?: string | null;
  Uri1024?: string | null;
  Uri1280?: string | null;
  Uri1600?: string | null;
};

/**
 * The StandardFields we read from a Spark listing, plus the listing Id and the MLS property class we
 * add while paging. Anything else in the record is ignored. Any field may be MASKED.
 */
export type SparkListing = {
  Id?: string;
  /** From /v1/propertytypes: Residential, MultiFamily, Land, Rental and so on. */
  PropertyClass?: string | null;
  ListingKey?: string | null;
  ListingId?: string | null;
  ModificationTimestamp?: string | null;
  OriginalEntryTimestamp?: string | null;
  OnMarketDate?: string | null;
  ListingContractDate?: string | null;
  StandardStatus?: string | null;
  MlsStatus?: string | null;
  ListPrice?: number | string | null;
  OriginalListPrice?: number | string | null;
  ClosePrice?: number | string | null;
  CloseDate?: string | null;
  PublicRemarks?: string | null;
  PropertyType?: string | null;
  PropertySubType?: string | null;
  UnparsedFirstLineAddress?: string | null;
  StreetNumber?: string | null;
  StreetDirPrefix?: string | null;
  StreetName?: string | null;
  StreetSuffix?: string | null;
  StreetDirSuffix?: string | null;
  UnitNumber?: string | null;
  City?: string | null;
  StateOrProvince?: string | null;
  PostalCode?: string | null;
  CountyOrParish?: string | null;
  Latitude?: number | string | null;
  Longitude?: number | string | null;
  BedsTotal?: number | string | null;
  BathsTotal?: number | string | null;
  BathsFull?: number | string | null;
  BathsHalf?: number | string | null;
  BathsThreeQuarter?: number | string | null;
  BuildingAreaTotal?: number | string | null;
  LivingArea?: number | string | null;
  LotSizeSquareFeet?: number | string | null;
  LotSizeAcres?: number | string | null;
  YearBuilt?: number | string | null;
  Stories?: number | string | null;
  StoriesTotal?: number | string | null;
  GarageSpaces?: number | string | null;
  ParkingTotal?: number | string | null;
  AssociationFee?: number | string | null;
  TaxAnnualAmount?: number | string | null;
  SubdivisionName?: string | null;
  SchoolDistrict?: string | null;
  ElementarySchool?: string | null;
  MiddleOrJuniorSchool?: string | null;
  HighSchool?: string | null;
  InternetEntireListingDisplayYN?: boolean | string | null;
  InternetAddressDisplayYN?: boolean | string | null;
  ListAgentName?: string | null;
  ListAgentFirstName?: string | null;
  ListAgentLastName?: string | null;
  ListAgentEmail?: string | null;
  ListAgentPreferredPhone?: string | null;
  ListAgentDirectPhone?: string | null;
  ListAgentOfficePhone?: string | null;
  ListAgentCellPhone?: string | null;
  ListAgentStateLicense?: string | null;
  ListOfficeName?: string | null;
  ListOfficePhone?: string | null;
  CoListAgentName?: string | null;
  CoListAgentFirstName?: string | null;
  CoListAgentLastName?: string | null;
  CoListOfficeName?: string | null;
  Photos?: SparkPhoto[] | null;
};

/** A field's value, or undefined when it is empty or masked for this key. */
function present<T>(v: T | null | undefined): T | undefined {
  if (v === null || v === undefined || v === MASKED) return undefined;
  if (typeof v === "string" && !v.trim()) return undefined;
  return v;
}
const text = (v: string | null | undefined) => present(v)?.trim() || undefined;
function num(v: number | string | null | undefined): number | undefined {
  const p = present(v);
  const n = typeof p === "string" ? Number(p) : p;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}
const posInt = (v: number | string | null | undefined) => {
  const n = num(v);
  return n !== undefined && n > 0 ? Math.round(n) : undefined;
};
function yesNo(v: boolean | string | null | undefined): boolean | undefined {
  const p = present(v);
  if (typeof p === "boolean") return p;
  if (typeof p === "string") return /^(y|yes|true)$/i.test(p) ? true : /^(n|no|false)$/i.test(p) ? false : undefined;
  return undefined;
}
const isoDate = (v: string | null | undefined) => {
  const p = present(v);
  return p && /^\d{4}-\d{2}-\d{2}/.test(p) ? p.slice(0, 10) : undefined;
};
const httpsUrl = (u: string | null | undefined) => {
  const p = present(u);
  return p && /^https:\/\/[^\s]+$/i.test(p) ? p : undefined;
};
const join = (...parts: (string | null | undefined)[]) => parts.map(text).filter(Boolean).join(" ") || undefined;
/** "GREAT FALLS" -> "Great Falls"; mixed case names are kept as the MLS wrote them. */
const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s);

/** The MLS's own property type codes (A, B, C...) mean different things per MLS; the class does not. */
function classCode(cls: string | null | undefined): string | undefined {
  const c = (cls ?? "").toLowerCase();
  if (/rental|lease/.test(c)) return "RNT";
  if (/multi/.test(c)) return "MLF";
  if (/land|lot/.test(c)) return "LND";
  if (/residential/.test(c)) return "RES";
  return undefined;
}

export function normalizeSpark(s: SparkListing): NormalizedListing {
  const code = classCode(s.PropertyClass);
  const rent = code === "RNT";
  const halfs = (num(s.BathsFull) ?? 0) + 0.5 * (num(s.BathsHalf) ?? 0) + 0.75 * (num(s.BathsThreeQuarter) ?? 0);
  const baths = num(s.BathsTotal) && num(s.BathsTotal)! > 0 ? num(s.BathsTotal) : halfs || undefined;
  const acres = num(s.LotSizeAcres);
  const lot = num(s.LotSizeSquareFeet) ?? (acres ? acres * 43_560 : undefined);
  const year = num(s.YearBuilt);
  const lat = num(s.Latitude);
  const lng = num(s.Longitude);
  const line1 =
    text(s.UnparsedFirstLineAddress) ??
    join(s.StreetNumber, s.StreetDirPrefix, s.StreetName, s.StreetSuffix, s.StreetDirSuffix) ??
    "";
  const unit = text(s.UnitNumber);
  const modified = present(s.ModificationTimestamp) ?? present(s.OriginalEntryTimestamp) ?? new Date(0).toISOString();
  const listDate =
    isoDate(s.OnMarketDate) ?? isoDate(s.ListingContractDate) ?? isoDate(s.OriginalEntryTimestamp) ?? isoDate(modified)!;
  // Spark writes statuses with spaces ("Active Under Contract"); the shared mapper expects none.
  const status = mapStatus((present(s.StandardStatus) ?? present(s.MlsStatus) ?? "").replace(/\s+/g, ""), rent);
  const soldDate = isoDate(s.CloseDate);
  const agentName = text(s.ListAgentName) ?? join(s.ListAgentFirstName, s.ListAgentLastName);
  const coAgentName = text(s.CoListAgentName) ?? join(s.CoListAgentFirstName, s.CoListAgentLastName);
  const city = text(s.City);
  const photos = (s.Photos ?? [])
    // Private photos are for agents only.
    .filter((p) => !p.Privacy || /^public$/i.test(p.Privacy))
    .sort((a, b) => Number(!!b.Primary) - Number(!!a.Primary));

  const record = {
    sourceListingId: text(s.ListingId) ?? text(s.ListingKey) ?? s.Id ?? "",
    sourceUpdatedAt: new Date(modified).toISOString(),
    listingType: rent ? "rent" : "sale",
    status,
    price: posInt(s.ListPrice) ?? 0,
    originalPrice: posInt(s.OriginalListPrice),
    soldPrice: status === "sold" ? posInt(s.ClosePrice) : undefined,
    listDate,
    statusDate: (status === "sold" || status === "leased") && soldDate ? soldDate : (isoDate(modified) ?? listDate),
    soldDate: status === "sold" ? soldDate : undefined,
    address: {
      line1,
      line2: unit && !line1.includes(unit) ? `Unit ${unit}` : undefined,
      city: city ? titleCase(city) : "",
      regionCode: stateCode(present(s.StateOrProvince)),
      postalCode: (text(s.PostalCode) ?? "").slice(0, 10),
      country: "US",
    },
    location: lat !== undefined && lng !== undefined && (lat !== 0 || lng !== 0) ? { lat, lng } : undefined,
    propertyType: mapPropertyType(code, present(s.PropertySubType)),
    beds: num(s.BedsTotal) !== undefined ? Math.min(num(s.BedsTotal)!, 20) : undefined,
    baths: baths !== undefined ? Math.min(baths, 20) : undefined,
    sqft: posInt(s.LivingArea) ?? posInt(s.BuildingAreaTotal),
    lotSqft: posInt(lot),
    yearBuilt: year && year >= 1800 && year <= 2100 ? Math.round(year) : undefined,
    stories: posInt(s.StoriesTotal) ?? posInt(s.Stories),
    parkingSpaces: posInt(s.ParkingTotal) ?? posInt(s.GarageSpaces),
    facts: Object.fromEntries(
      Object.entries({
        mls_number: text(s.ListingId),
        spark_listing_key: text(s.ListingKey),
        county: text(s.CountyOrParish),
        subdivision: text(s.SubdivisionName),
        school_district: text(s.SchoolDistrict),
        elementary_school: text(s.ElementarySchool),
        middle_school: text(s.MiddleOrJuniorSchool),
        high_school: text(s.HighSchool),
      }).filter(([, v]) => v !== undefined),
    ),
    features: { interior: [], exterior: [], building: [], community: [] },
    rentalTerms: rent ? {} : undefined,
    description: text(s.PublicRemarks),
    hoaFee: num(s.AssociationFee) !== undefined && num(s.AssociationFee)! >= 0 ? Math.round(num(s.AssociationFee)!) : undefined,
    taxAnnual: num(s.TaxAnnualAmount) !== undefined && num(s.TaxAnnualAmount)! >= 0 ? Math.round(num(s.TaxAnnualAmount)!) : undefined,
    media: photos
      .map((p) => ({ url: httpsUrl(p.Uri1600) ?? httpsUrl(p.Uri1280) ?? httpsUrl(p.Uri1024) ?? httpsUrl(p.Uri800) ?? httpsUrl(p.Uri640), caption: text(p.Caption) }))
      .filter((p): p is { url: string; caption: string | undefined } => !!p.url)
      .slice(0, 60)
      .map((p, position) => ({ url: p.url, kind: "photo" as const, position, caption: p.caption })),
    agent: {
      name: agentName ?? "Listing agent",
      email: text(s.ListAgentEmail),
      phone: text(s.ListAgentPreferredPhone) ?? text(s.ListAgentDirectPhone) ?? text(s.ListAgentOfficePhone) ?? text(s.ListAgentCellPhone),
      licenseNumber: text(s.ListAgentStateLicense),
      brokerage: text(s.ListOfficeName) ?? "Listing office",
      officePhone: text(s.ListOfficePhone),
      coAgentName,
      coBrokerage: text(s.CoListOfficeName),
    },
    display: {
      internet: yesNo(s.InternetEntireListingDisplayYN) === false ? false : undefined,
      address: yesNo(s.InternetAddressDisplayYN) === false ? false : undefined,
    },
  };
  return NormalizedListingSchema.parse(record);
}

type SparkResponse<T> = {
  D?: { Success?: boolean; Message?: string; Results?: T[]; Pagination?: { TotalPages?: number; CurrentPage?: number } };
};

export function sparkAdapter(opts: { token: string; fetchImpl?: typeof fetch; baseUrl?: string; maxPageSize?: number }): ListingFeedAdapter & {
  inlineMedia(url: string): { storageKey: string; blurDataUrl: string; width: number; height: number } | null;
} {
  const base = (opts.baseUrl ?? BASE).replace(/\/+$/, "");
  const doFetch = opts.fetchImpl ?? fetch;
  const origins = feedPhotoOrigins();
  const maxPage = Math.min(Math.max(opts.maxPageSize ?? DEFAULT_PAGE, 1), MAX_PAGE);
  const headers = {
    Authorization: `Bearer ${opts.token}`,
    Accept: "application/json",
    // Spark asks every client to name itself.
    "X-SparkApi-User-Agent": brand.name.replace(/\s+/g, ""),
  };

  async function get<T>(path: string, qs?: URLSearchParams) {
    const res = await doFetch(`${base}${path}${qs ? `?${qs}` : ""}`, { headers, signal: AbortSignal.timeout(30_000) });
    const body = (await res.json().catch(() => ({}))) as SparkResponse<T>;
    if (!res.ok || body.D?.Success === false) throw new Error(`Spark ${res.status}: ${(body.D?.Message ?? "").slice(0, 200)}`);
    return body.D ?? {};
  }

  return {
    source: "spark",

    async *fetchChanged(cursor, pageSize) {
      const limit = Math.min(Math.max(pageSize, 1), maxPage);
      // Property type codes are per MLS; their class tells a rental or land listing apart.
      const types = await get<{ MlsCode?: string; PropertyClass?: string }>("/v1/propertytypes").catch(() => ({ Results: [] }));
      const classes = new Map((types.Results ?? []).map((t) => [t.MlsCode ?? "", t.PropertyClass ?? ""]));

      for (let page = 1; page <= 100_000; page++) {
        const qs = new URLSearchParams({
          _limit: String(limit),
          _pagination: "1",
          _page: String(page),
          _orderby: "+ListingKey",
          _expand: "Photos",
        });
        // Whole seconds: a listing changed in the same second as the cursor is fetched again and skipped
        // as unchanged, instead of missed.
        if (cursor) qs.set("_filter", `ModificationTimestamp Gt ${cursor.replace(/\.\d+Z$/, "Z")}`);
        const d = await get<{ Id?: string; StandardFields?: Record<string, unknown> }>("/v1/listings", qs);
        const items: RawListing[] = (d.Results ?? []).map((r) => {
          const f = r.StandardFields ?? {};
          return { ...f, Id: r.Id, PropertyClass: classes.get(String(f.PropertyType ?? "")) ?? null, sourceListingId: f.ListingId };
        });
        if (!items.length) return;
        let maxModified: string | null = cursor;
        for (const it of items) {
          const m = typeof it.ModificationTimestamp === "string" ? new Date(it.ModificationTimestamp) : null;
          const iso = m && !Number.isNaN(m.getTime()) ? m.toISOString() : null;
          if (iso && (!maxModified || iso > maxModified)) maxModified = iso;
        }
        yield { items, nextCursor: maxModified };
        const total = d.Pagination?.TotalPages;
        if (total !== undefined ? page >= total : items.length < limit) return;
      }
    },

    normalize(raw) {
      return normalizeSpark(raw as unknown as SparkListing);
    },

    /** Photos are served from Spark's CDN; only CDNs listed in FEED_PHOTO_ORIGINS are used. */
    inlineMedia(url) {
      if (!origins.some((o) => url.startsWith(`${o}/`))) return null;
      return { storageKey: url, blurDataUrl: NEUTRAL_BLUR, width: 1600, height: 1200 };
    },
  };
}
