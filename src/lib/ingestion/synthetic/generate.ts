import type { PropertyType } from "@/db/schema/listings";
import { clamp, Rng } from "@/lib/random";
import { brand } from "@/config/brand";
import { market } from "@/config/market";
import { slugify } from "@/lib/slug";
import type { NormalizedListing } from "../types";
import {
  BROKERAGES,
  CITY_DEFS,
  NEIGHBORHOOD_PREFIXES,
  NEIGHBORHOOD_SUFFIXES,
  STREET_NAMES,
  STREET_SUFFIXES,
  type CityDef,
} from "./market";
import { trueRent, trueValue } from "./model";

// ---------- geometry helpers (planar lng/lat, matching PostGIS Voronoi on geometry) ----------

type Pt = [number, number];

export function pointInRing([x, y]: Pt, ring: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function bbox(ring: Pt[]) {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function distanceKm([lng1, lat1]: Pt, [lng2, lat2]: Pt): number {
  const kx = 111.32 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.hypot((lng2 - lng1) * kx, (lat2 - lat1) * 110.57);
}

const planar2 = (a: Pt, b: Pt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

/** US: the ZIP code. Canada: the area plus a local delivery unit, like "M5V 1A1". */
function postalCode(hood: { postalArea: string }, street: { ldu: string }): string {
  return brand.market.country === "US" ? hood.postalArea : `${hood.postalArea} ${street.ldu}`;
}

// ---------- types ----------

export type NeighborhoodSeed = {
  name: string;
  slug: string;
  point: Pt;
  factor: number;
  /** ZIP code (US) or forward sortation area (Canada) for addresses here. */
  postalArea: string;
  /** Local housing mix: real neighborhoods skew heavily toward a few home types. */
  typeMix: Partial<Record<PropertyType, number>>;
  /** Local share of rentals relative to the city (dense cores rent more). */
  rentFactor: number;
  /** Typical home size relative to the city norm. */
  sizeScale: number;
  /** Year most houses here were built. */
  era: number;
};

type Building = { line1: string; point: Pt; floors: number; yearBuilt: number; units: Set<number>; postal: string };

export type SyntheticCity = CityDef & {
  hoods: NeighborhoodSeed[];
  streets: Map<string, { name: string; ldu: string }[]>;
  buildings: Map<string, Building[]>;
  usedAddresses: Set<string>;
};

export type SyntheticPro = {
  key: string;
  proType: "agent" | "lender" | "landlord" | "property_manager";
  displayName: string;
  email: string;
  phone: string;
  brokerageName: string | null;
  licenseNumber: string | null;
  yearsExperience: number;
  rating: number;
  reviewCount: number;
  responseTimeMinutes: number;
  bio: string;
  /** City slugs, or "city/neighborhood" slugs for neighborhood coverage. */
  serviceAreas: string[];
  languages: string[];
};

export type Truth = { sourceListingId: string; city: string; trueValueNow: number; trueRentNow: number };

export type GeneratedMarket = {
  asOf: string;
  cities: SyntheticCity[];
  pros: SyntheticPro[];
  listings: NormalizedListing[];
  truth: Truth[];
};

// ---------- small helpers ----------

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const roundTo = (v: number, step: number) => Math.round(v / step) * step;
const LETTERS = "ABCEGHJKLMNPRSTVWXYZ";

function sampleSubset<T>(rng: Rng, items: readonly T[], min: number, max: number): T[] {
  const pool = [...items];
  const n = Math.min(pool.length, rng.int(min, max));
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  return out;
}

// ---------- cities and neighborhoods ----------

function buildCity(rng: Rng, def: CityDef): SyntheticCity {
  const box = bbox(def.boundary);
  const minD = 0.55 * Math.sqrt(((box.maxX - box.minX) * (box.maxY - box.minY)) / def.neighborhoods);
  const points: Pt[] = [];
  let spacing = minD;
  for (let attempt = 0; points.length < def.neighborhoods; attempt++) {
    if (attempt > 0 && attempt % 2000 === 0) spacing *= 0.85;
    const p: Pt = [rng.range(box.minX, box.maxX), rng.range(box.minY, box.maxY)];
    if (!pointInRing(p, def.boundary)) continue;
    if (points.some((q) => Math.sqrt(planar2(p, q)) < spacing)) continue;
    points.push(p);
  }

  const names = new Set<string>();
  const hoods: NeighborhoodSeed[] = points.map((point, i) => {
    let name: string;
    do name = `${rng.pick(NEIGHBORHOOD_PREFIXES)} ${rng.pick(NEIGHBORHOOD_SUFFIXES)}`;
    while (names.has(name));
    names.add(name);
    const central = 1 + 0.3 * Math.exp(-distanceKm(point, def.center) / 5);
    const typeMix = Object.fromEntries(
      Object.entries(def.typeMix).map(([t, w]) => [t, (w as number) * rng.lognormal(1.3)]),
    ) as Partial<Record<PropertyType, number>>;
    return {
      name,
      slug: slugify(name),
      point,
      factor: clamp(rng.lognormal(0.1) * central, 0.6, 1.9),
      postalArea: def.postalAreas[i % def.postalAreas.length],
      typeMix,
      rentFactor: clamp(rng.lognormal(0.6) * (0.7 + 0.6 * Math.exp(-distanceKm(point, def.center) / 6)), 0.2, 4),
      sizeScale: clamp(rng.lognormal(0.2), 0.65, 1.5),
      // Older cores near the center, newer suburbs further out.
      era: Math.round(clamp(1915 + distanceKm(point, def.center) * 6 + rng.normal(0, 15), 1900, 2020)),
    };
  });

  const usedStreetNames = new Set<string>();
  const streets = new Map<string, { name: string; ldu: string }[]>();
  for (const h of hoods) {
    const list: { name: string; ldu: string }[] = [];
    const count = rng.int(8, 14);
    for (let s = 0; s < count; s++) {
      let street: string;
      do street = `${rng.pick(STREET_NAMES)} ${rng.pick(STREET_SUFFIXES)}`;
      while (usedStreetNames.has(street));
      usedStreetNames.add(street);
      list.push({ name: street, ldu: `${rng.int(1, 9)}${rng.pick([...LETTERS])}${rng.int(0, 9)}` });
    }
    streets.set(h.slug, list);
  }

  return { ...def, hoods, streets, buildings: new Map(), usedAddresses: new Set() };
}

function nearestHood(city: SyntheticCity, p: Pt): NeighborhoodSeed {
  let best = city.hoods[0];
  let bestD = Infinity;
  for (const h of city.hoods) {
    const d = planar2(p, h.point);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

function samplePoint(rng: Rng, city: SyntheticCity): Pt {
  const box = bbox(city.boundary);
  const spread = 0.22 * Math.sqrt(((box.maxX - box.minX) * (box.maxY - box.minY)) / city.hoods.length);
  for (;;) {
    let p: Pt;
    if (rng.bool(0.85)) {
      const h = rng.pick(city.hoods);
      p = [rng.normal(h.point[0], spread), rng.normal(h.point[1], spread * 0.75)];
    } else {
      p = [rng.range(box.minX, box.maxX), rng.range(box.minY, box.maxY)];
    }
    if (pointInRing(p, city.boundary)) return [Number(p[0].toFixed(6)), Number(p[1].toFixed(6))];
  }
}

// ---------- pros ----------

const FIRST = ["Avery", "Jordan", "Riley", "Morgan", "Casey", "Taylor", "Quinn", "Rowan", "Harper", "Emerson", "Parker", "Reese", "Sasha", "Devon", "Kendall", "Logan", "Micah", "Noor", "Priya", "Arjun", "Mei", "Wei", "Amara", "Kofi", "Luca", "Sofia", "Mateo", "Nadia", "Omar", "Leila", "Hana", "Kai", "Elena", "Theo", "Maya", "Ravi", "Zara", "Ines", "Tomas", "Yara"];
const LAST = ["Anders", "Bishop", "Chen", "Dubois", "Ellis", "Fraser", "Grant", "Hughes", "Ibrahim", "Jensen", "Khan", "Lambert", "Moreau", "Nakamura", "Okafor", "Patel", "Quintero", "Rossi", "Singh", "Tremblay", "Umar", "Vasquez", "Walsh", "Xu", "Young", "Zhang", "Bennett", "Carter", "Dalton", "Fischer", "Gallo", "Hart", "Iyer", "Kowalski", "Lindqvist", "Mendes", "Novak", "Osei", "Park", "Reyes"];

function buildPros(rng: Rng, cities: SyntheticCity[]): SyntheticPro[] {
  const pros: SyntheticPro[] = [];
  const plan: [SyntheticPro["proType"], number][] = [["agent", 150], ["lender", 30], ["landlord", 12], ["property_manager", 8]];
  let n = 0;
  for (const [proType, count] of plan) {
    for (let i = 0; i < count; i++, n++) {
      const name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
      const city = rng.weighted(Object.fromEntries(cities.map((c) => [c.slug, c.share])) as Record<string, number>);
      const cityDef = cities.find((c) => c.slug === city)!;
      // Agents cover either a whole city or a few neighborhoods; one in twenty has no area yet.
      let serviceAreas: string[];
      if (proType === "agent" && i % 20 === 19) serviceAreas = [];
      else if (rng.bool(0.4)) serviceAreas = [city];
      else serviceAreas = sampleSubset(rng, cityDef.hoods, 2, 6).map((h) => `${city}/${h.slug}`);
      const years = rng.int(1, 30);
      pros.push({
        key: `pro${String(n + 1).padStart(3, "0")}`,
        proType,
        displayName: name,
        email: `pro${String(n + 1).padStart(3, "0")}@example.com`,
        phone: `(${brand.market.country === "US" ? 213 : 416}) 555 01${String(n % 100).padStart(2, "0")}`,
        brokerageName: proType === "agent" ? rng.pick(BROKERAGES) : proType === "lender" ? "Northstar Mortgage Group" : null,
        licenseNumber: proType === "agent" || proType === "lender" ? String(4_000_000 + n * 37) : null,
        yearsExperience: years,
        rating: Number(clamp(rng.normal(4.5, 0.35), 3, 5).toFixed(1)),
        reviewCount: rng.int(0, 120),
        responseTimeMinutes: rng.int(3, 90),
        bio: `${name} has helped clients in ${cityDef.name} for ${years} ${years === 1 ? "year" : "years"}.`,
        serviceAreas,
        languages: rng.bool(0.3) ? ["en", rng.pick(["fr", "zh", "pa", "es", "ar", "tl"])] : ["en"],
      });
    }
  }
  return pros;
}

// ---------- properties ----------

type Draft = {
  city: SyntheticCity;
  hood: NeighborhoodSeed;
  point: Pt;
  line1: string;
  line2?: string;
  postal: string;
  type: PropertyType;
  beds?: number;
  baths?: number;
  sqft?: number;
  lotSqft?: number;
  yearBuilt?: number;
  stories?: number;
  parking?: number;
  rng: Rng;
};

/**
 * Home size by type. Each neighborhood has its own typical size (hood.sizeScale), and homes
 * vary around it less than they vary across the city, as in real subdivisions.
 */
function houseSize(rng: Rng, type: PropertyType, hood: NeighborhoodSeed) {
  const s = hood.sizeScale;
  switch (type) {
    case "condo": {
      const sqft = Math.round(clamp(rng.normal(760 * s, 160), 380, 2200));
      return { sqft, beds: sqft < 560 ? 1 : sqft < 900 ? 2 : 3, baths: sqft < 800 ? 1 : 2, lot: undefined };
    }
    case "detached": {
      const sqft = Math.round(clamp(rng.normal(2100 * s, 2100 * s * 0.16), 900, 6500));
      return {
        sqft,
        beds: clamp(Math.round(sqft / 550), 2, 7),
        baths: clamp(Math.round((sqft / 700) * 2) / 2, 1, 6),
        lot: Math.round(clamp(rng.normal(4500 * s, 900), 2000, 20000)),
      };
    }
    case "semi": {
      const sqft = Math.round(clamp(rng.normal(1500 * s, 1500 * s * 0.14), 800, 3200));
      return { sqft, beds: clamp(Math.round(sqft / 500), 2, 5), baths: clamp(Math.round((sqft / 650) * 2) / 2, 1, 4), lot: rng.int(2600, 4200) };
    }
    case "townhouse": {
      const sqft = Math.round(clamp(rng.normal(1450 * s, 1450 * s * 0.14), 800, 3000));
      return { sqft, beds: clamp(Math.round(sqft / 500), 2, 4), baths: clamp(Math.round((sqft / 600) * 2) / 2, 1.5, 4), lot: rng.bool(0.5) ? rng.int(1500, 3000) : undefined };
    }
    case "multi": {
      const sqft = Math.round(clamp(rng.normal(2800 * s, 2800 * s * 0.16), 1500, 6000));
      return { sqft, beds: clamp(Math.round(sqft / 450), 3, 10), baths: clamp(Math.round(sqft / 700), 2, 6), lot: rng.int(3500, 7000) };
    }
    default:
      return { sqft: undefined, beds: undefined, baths: undefined, lot: rng.int(4000, 40000) };
  }
}

/** Houses in a neighborhood were mostly built in the same era; condos get their building's year. */
function yearBuilt(rng: Rng, type: PropertyType, hood: NeighborhoodSeed): number | undefined {
  if (type === "land") return undefined;
  if (type === "condo") return Math.round(1965 + 60 * Math.sqrt(rng.next()));
  const year = Math.round(clamp(rng.normal(hood.era, 9), 1880, 2025));
  return type === "townhouse" ? Math.max(1965, year) : year;
}

function draftProperty(rng: Rng, city: SyntheticCity): Draft {
  let point = samplePoint(rng, city);
  const hood = nearestHood(city, point);
  const type = rng.weighted(hood.typeMix as Record<PropertyType, number>);
  const size = houseSize(rng, type, hood);

  if (type === "condo") {
    const list = city.buildings.get(hood.slug) ?? [];
    city.buildings.set(hood.slug, list);
    let b: Building | undefined = list.length > 0 && !rng.bool(1 / 70) ? rng.pick(list) : undefined;
    if (b && b.units.size >= b.floors * 12) b = undefined;
    if (!b) {
      const streets = city.streets.get(hood.slug)!;
      const street = rng.pick(streets);
      let line1: string;
      do line1 = `${rng.int(1, 400)} ${street.name}`;
      while (city.usedAddresses.has(line1));
      city.usedAddresses.add(line1);
      b = { line1, point, floors: rng.int(6, 48), yearBuilt: yearBuilt(rng, "condo", hood)!, units: new Set(), postal: postalCode(hood, street) };
      list.push(b);
    }
    let unit: number;
    do unit = rng.int(1, b.floors) * 100 + rng.int(1, 12);
    while (b.units.has(unit));
    b.units.add(unit);
    point = b.point;
    return {
      city, hood, point, line1: b.line1, line2: `Unit ${unit}`, postal: b.postal, type,
      beds: size.beds, baths: size.baths, sqft: size.sqft, yearBuilt: b.yearBuilt,
      stories: undefined, parking: rng.bool(0.6) ? 1 : 0, rng,
    };
  }

  const streets = city.streets.get(hood.slug)!;
  let line1: string;
  let street: { name: string; ldu: string };
  do {
    street = rng.pick(streets);
    line1 = `${rng.int(1, 499)} ${street.name}`;
  } while (city.usedAddresses.has(line1));
  city.usedAddresses.add(line1);

  return {
    city, hood, point, line1, postal: postalCode(hood, street), type,
    beds: size.beds, baths: size.baths, sqft: size.sqft, lotSqft: size.lot, yearBuilt: yearBuilt(rng, type, hood),
    stories: type === "land" ? undefined : type === "detached" ? rng.int(1, 3) : 2,
    parking: type === "land" ? undefined : type === "detached" ? rng.int(1, 4) : rng.int(0, 2), rng,
  };
}

// ---------- descriptive content (no dashes in copy) ----------

const TYPE_WORD: Record<PropertyType, string> = {
  detached: "detached home", semi: "semi detached home", townhouse: "townhouse", condo: "condo",
  multi: "multi unit property", land: "lot", other: "home",
};
const INTERIOR = ["Hardwood floors", "Updated kitchen", "Quartz counters", "Stainless steel appliances", "Walk in closet", "Gas fireplace", "Pot lights", "Ensuite laundry", "Open concept living", "Heated bathroom floors", "Large windows", "Smart thermostat"];
const EXTERIOR_HOUSE = ["Private backyard", "Deck", "Patio", "Double garage", "Fenced yard", "Garden", "Interlock driveway", "Covered porch"];
const EXTERIOR_CONDO = ["Balcony", "Terrace", "Lake view", "City view"];
const BUILDING = ["Concierge", "Gym", "Party room", "Rooftop terrace", "Visitor parking", "Bike storage", "Pool", "Guest suites"];
const COMMUNITY = ["Close to transit", "Near parks", "Walk to shops", "Near schools", "Trail access", "Community center nearby"];
const ROOMS: Record<string, string[]> = {
  condo: ["Living room", "Kitchen", "Primary bedroom", "Bathroom", "Balcony view", "Building lobby", "Second bedroom", "Dining area", "Gym", "Rooftop terrace"],
  house: ["Front exterior", "Living room", "Kitchen", "Dining room", "Primary bedroom", "Bathroom", "Backyard", "Second bedroom", "Basement", "Family room", "Office", "Laundry room", "Garage", "Street view"],
  land: ["Lot view", "Street view", "Aerial view", "Surrounding area", "Lot boundary"],
};

/** ["Near parks", "Close to transit", "Walk to shops"] -> "Near parks, close to transit and walk to shops" */
function sentenceList(items: string[]): string {
  const parts = items.map((s, i) => (i === 0 ? s : s.charAt(0).toLowerCase() + s.slice(1)));
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function describe(d: Draft, features: NormalizedListing["features"], listingType: "sale" | "rent"): string {
  const r = d.rng;
  const adj = r.pick(["Bright", "Spacious", "Well kept", "Sunny", "Updated", "Charming", "Modern", "Renovated"]);
  if (d.type === "land") {
    return `${adj} building lot in ${d.hood.name}, ${d.city.name}. ${features.community[0] ?? "Close to amenities"}. Services available at the lot line, subject to municipal approval.`;
  }
  const bedWord = `${d.beds} bedroom`;
  const s1 = `${adj} ${bedWord} ${TYPE_WORD[d.type]} in ${d.hood.name}, ${d.city.name}.`;
  const s2 = `${sentenceList(features.interior.slice(0, 2))} throughout${features.exterior[0] ? `, plus ${features.exterior[0].toLowerCase()}` : ""}.`;
  const s3 = `${sentenceList(features.community)}.`;
  const s4 = listingType === "rent" ? r.pick(["Available for a 12 month lease.", "Tenant pays hydro.", "Minimum one year lease."]) : r.pick(["Book a showing today.", "Move in ready.", "A great place to call home."]);
  return `${s1} ${s2} ${s3} ${s4}`;
}

// ---------- listings ----------

function buildListing(
  d: Draft,
  index: number,
  listingType: "sale" | "rent",
  status: "active" | "pending" | "closed",
  asOf: Date,
  agents: SyntheticPro[],
): { listing: NormalizedListing; truth: Truth } {
  const r = d.rng;
  const isCondo = d.type === "condo";
  const features = {
    interior: d.type === "land" ? [] : sampleSubset(r, INTERIOR, 3, 6),
    exterior: d.type === "land" ? [] : sampleSubset(r, isCondo ? EXTERIOR_CONDO : EXTERIOR_HOUSE, 1, 3),
    building: isCondo ? sampleSubset(r, BUILDING, 2, 5) : [],
    community: sampleSubset(r, COMMUNITY, 2, 3),
  };
  const input = { propertyType: d.type, sqft: d.sqft, beds: d.beds, baths: d.baths, yearBuilt: d.yearBuilt, lotSqft: d.lotSqft, neighborhoodFactor: d.hood.factor };

  const history: NonNullable<NormalizedListing["history"]> = [];
  let listDate: Date;
  let statusDate: Date;
  let soldDate: Date | undefined;
  let price: number;
  let originalPrice: number;
  let soldPrice: number | undefined;
  const dom = Math.round(clamp(-Math.log(1 - r.next()) * (listingType === "sale" ? 24 : 14), 1, 180));
  const priceOf = (date: Date) => {
    const v = trueValue(d.city, input, date);
    return listingType === "sale" ? v : trueRent(v, d.type);
  };
  const step = listingType === "sale" ? 1000 : 25;

  if (status === "closed") {
    soldDate = addDays(asOf, -r.int(3, 730));
    listDate = addDays(soldDate, -dom);
    statusDate = soldDate;
    originalPrice = roundTo(priceOf(listDate) * r.lognormal(0.02) * (listingType === "sale" ? 1.02 : 1), step);
    soldPrice = roundTo(priceOf(soldDate) * r.lognormal(listingType === "sale" ? 0.045 : 0.04), step);
    price = originalPrice;
  } else if (status === "pending") {
    const pendingAge = r.int(1, 30);
    statusDate = addDays(asOf, -pendingAge);
    listDate = addDays(statusDate, -dom);
    originalPrice = roundTo(priceOf(listDate) * r.lognormal(0.02) * (listingType === "sale" ? 1.02 : 1), step);
    price = originalPrice;
  } else {
    listDate = addDays(asOf, -dom);
    statusDate = listDate;
    originalPrice = roundTo(priceOf(listDate) * r.lognormal(0.02) * (listingType === "sale" ? 1.02 : 1), step);
    price = originalPrice;
  }

  history.push({ eventType: "listed", price: originalPrice, date: iso(listDate) });
  if (dom > 20 && r.bool(0.3)) {
    price = roundTo(originalPrice * r.range(0.95, 0.98), step);
    const changeDate = addDays(listDate, Math.round(dom / 2));
    history.push({ eventType: "price_change", price, date: iso(changeDate) });
    if (status === "active") statusDate = changeDate;
  }
  if (status === "pending") history.push({ eventType: "pending", price, date: iso(statusDate) });
  if (status === "closed" && soldDate) {
    if (listingType === "sale") history.push({ eventType: "pending", price, date: iso(addDays(soldDate, -Math.min(dom, r.int(5, 20)))) });
    history.push({ eventType: listingType === "sale" ? "sold" : "leased", price: soldPrice, date: iso(soldDate) });
  }

  const agent = agents[index % agents.length];
  const mediaCount = r.int(5, 20);
  const rooms = d.type === "land" ? ROOMS.land : isCondo ? ROOMS.condo : ROOMS.house;
  const sourceListingId = `GH${String(index + 1).padStart(7, "0")}`;
  const value = trueValue(d.city, input, asOf);
  const updated = new Date(statusDate.getTime() + 12 * 3600_000 + r.int(0, 3599) * 1000);

  const listing: NormalizedListing = {
    sourceListingId,
    sourceUpdatedAt: updated.toISOString(),
    listingType,
    status: status === "closed" ? (listingType === "sale" ? "sold" : "leased") : status,
    price,
    originalPrice,
    soldPrice,
    listDate: iso(listDate),
    statusDate: iso(statusDate),
    soldDate: soldDate ? iso(soldDate) : undefined,
    availableDate: listingType === "rent" && status !== "closed" ? iso(addDays(asOf, r.int(0, 60))) : undefined,
    address: { line1: d.line1, line2: d.line2, city: d.city.name, regionCode: market.regionCode, postalCode: d.postal, country: brand.market.country },
    location: { lng: d.point[0], lat: d.point[1] },
    propertyType: d.type,
    beds: d.beds,
    baths: d.baths,
    sqft: d.sqft,
    lotSqft: d.lotSqft,
    yearBuilt: d.yearBuilt,
    stories: d.stories,
    parkingSpaces: d.parking,
    facts:
      d.type === "land"
        ? { zoning: r.pick(["Residential", "Mixed use"]) }
        : {
            heating: r.pick(["Forced air, gas", "Radiant", "Heat pump", "Baseboard, electric"]),
            cooling: r.pick(["Central air", "Heat pump", "None", "Wall units"]),
            basement: isCondo ? "None" : r.pick(["Finished", "Partially finished", "Unfinished", "None"]),
            exterior: isCondo ? "Concrete" : r.pick(["Brick", "Stone and brick", "Vinyl siding", "Stucco", "Wood"]),
            roof: isCondo ? "Flat" : r.pick(["Asphalt shingle", "Metal", "Flat"]),
            parking: isCondo ? (d.parking ? "Underground" : "None") : r.pick(["Attached garage", "Detached garage", "Driveway"]),
          },
    features,
    rentalTerms:
      listingType === "rent"
        ? {
            pets: r.bool(0.45),
            furnished: r.bool(0.15),
            laundry: isCondo ? "In suite" : r.pick(["In suite", "Shared", "None"]),
            parking: (d.parking ?? 0) > 0,
            utilities_included: sampleSubset(r, ["Water", "Heat", "Hydro", "Internet"], 0, 2),
            lease_min_months: 12,
            deposit: price,
          }
        : undefined,
    description: "",
    hoaFee: isCondo ? Math.round(((d.sqft ?? 700) * r.range(0.6, 0.9)) / 5) * 5 : undefined,
    taxAnnual: listingType === "sale" ? Math.round((value * r.range(market.finance.taxRate * 0.85, market.finance.taxRate * 1.15)) / 10) * 10 : undefined,
    media: Array.from({ length: mediaCount }, (_, i) => ({
      url: `synthetic://${sourceListingId}/${i}`,
      kind: "photo" as const,
      position: i,
      caption: rooms[i % rooms.length],
    })),
    agent: {
      name: agent.displayName,
      email: agent.email,
      phone: agent.phone,
      licenseNumber: agent.licenseNumber ?? undefined,
      brokerage: agent.brokerageName ?? BROKERAGES[0],
    },
    history,
  };
  listing.description = describe(d, features, listingType);

  return {
    listing,
    truth: { sourceListingId, city: d.city.slug, trueValueNow: value, trueRentNow: trueRent(value, d.type) },
  };
}

// ---------- entry point ----------

export function generateMarket(opts: { seed: number; total: number; asOf: Date }): GeneratedMarket {
  const root = new Rng(opts.seed);
  const cities = CITY_DEFS.map((def, i) => buildCity(root.fork(100 + i), def));
  const pros = buildPros(root.fork(200), cities);
  const agents = pros.filter((p) => p.proType === "agent");

  // Exact per city counts that sum to total.
  const counts = cities.map((c) => Math.floor(c.share * opts.total));
  counts[0] += opts.total - counts.reduce((s, n) => s + n, 0);

  const drafts: Draft[] = [];
  cities.forEach((city, ci) => {
    const rng = root.fork(300 + ci);
    for (let i = 0; i < counts[ci]; i++) drafts.push(draftProperty(rng.fork(i), city));
  });

  // Exactly 30% rentals, weighted towards condos and multi unit homes.
  // Rentals skew to condos and apartments; whole house rentals are comparatively rare.
  const rentWeight: Record<PropertyType, number> = { condo: 4, multi: 0.4, townhouse: 1.3, semi: 0.6, detached: 0.12, land: 0, other: 1 };
  const pickRng = root.fork(400);
  const keyed = drafts.map((d, i) => {
    const w = rentWeight[d.type] * d.hood.rentFactor;
    return { i, key: w === 0 ? -1 : Math.pow(pickRng.next(), 1 / w) };
  });
  keyed.sort((a, b) => b.key - a.key);
  const rentCount = Math.round(opts.total * 0.3);
  const isRent = new Set(keyed.slice(0, rentCount).map((k) => k.i));

  // Exact status splits within each listing type: 60% active, 15% pending, 25% closed.
  const statusRng = root.fork(500);
  const statusFor = new Map<number, "active" | "pending" | "closed">();
  for (const type of ["sale", "rent"] as const) {
    const idx = drafts.map((_, i) => i).filter((i) => isRent.has(i) === (type === "rent"));
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(statusRng.next() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const a = Math.round(idx.length * 0.6);
    const p = Math.round(idx.length * 0.15);
    idx.forEach((draftIndex, k) => statusFor.set(draftIndex, k < a ? "active" : k < a + p ? "pending" : "closed"));
  }

  const listings: NormalizedListing[] = [];
  const truth: Truth[] = [];
  drafts.forEach((d, i) => {
    const out = buildListing(d, i, isRent.has(i) ? "rent" : "sale", statusFor.get(i)!, opts.asOf, agents);
    listings.push(out.listing);
    truth.push(out.truth);
  });
  // Feeds deliver oldest changes first, so cursors advance monotonically.
  listings.sort((a, b) => a.sourceUpdatedAt.localeCompare(b.sourceUpdatedAt) || a.sourceListingId.localeCompare(b.sourceListingId));

  return { asOf: iso(opts.asOf), cities, pros, listings, truth };
}
