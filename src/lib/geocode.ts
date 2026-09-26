import type postgres from "postgres";
import { brand } from "@/config/brand";
import { normalizeStreet } from "@/lib/ingestion/address";

// Geocoding for address lookup (docs/02 GET /api/properties/lookup) and for feeds without
// coordinates (docs/03 step b). MapTiler when a key is configured; otherwise a local geocoder that
// places an address between known house numbers on the same street in a seeded city.

export type ParsedAddress = { number: number; street: string; unit: string | null; city: string | null; postal: string | null };

const POSTAL = /\b([A-Za-z]\d[A-Za-z])\s?(\d[A-Za-z]\d)\b/;
// A US ZIP only counts at the end of the input, so a five digit house number is never taken for one.
const ZIP = /(?:,|\s)\s*(\d{5})(?:-(\d{4}))?\s*$/;
const REGION_WORDS = /\b(ON|Ontario|Canada|CA|California|USA|United States)\b\.?/gi;
// "#" is not a word character, so it cannot sit after a \b like the word forms.
const UNIT = /(?:\b(?:unit|apt|apartment|suite|ste)\b\.?\s*|#\s*)([A-Za-z0-9]+)\b/i;

/**
 * "Unit 1204, 88 Harbor St, San Francisco, CA 94110" or "Unit 1204, 88 Harbor St, Toronto, ON M5V 1A1"
 * -> { number: 88, street: "Harbor St", unit: "1204", city, postal }
 */
export function parseAddress(input: string): ParsedAddress | null {
  let rest = input.trim();
  const postalMatch = rest.match(POSTAL);
  let postal = postalMatch ? `${postalMatch[1]} ${postalMatch[2]}`.toUpperCase() : null;
  if (postalMatch) rest = rest.replace(postalMatch[0], " ");
  const zipMatch = postal ? null : rest.match(ZIP);
  if (zipMatch) {
    postal = zipMatch[2] ? `${zipMatch[1]}-${zipMatch[2]}` : zipMatch[1];
    rest = rest.slice(0, zipMatch.index);
  }
  const unitMatch = rest.match(UNIT);
  const unit = unitMatch ? unitMatch[1] : null;
  if (unitMatch) rest = rest.replace(unitMatch[0], " ");
  rest = rest.replace(REGION_WORDS, " ");

  const parts = rest.split(",").map((p) => p.trim()).filter(Boolean);
  const streetPartIndex = parts.findIndex((p) => /^\d+\s+\S/.test(p));
  if (streetPartIndex < 0) return null;
  const m = parts[streetPartIndex].match(/^(\d+)\s+(.+)$/)!;
  let street = m[2].trim();
  let city = parts.slice(streetPartIndex + 1).find((p) => /[A-Za-z]/.test(p)) ?? null;
  // "88 Harbor St San Francisco" without commas: split off a known city name at the end first.
  if (!city) {
    const known = brand.market.cities.find((c) => street.toLowerCase().endsWith(` ${c.name.toLowerCase()}`));
    if (known) {
      city = known.name;
      street = street.slice(0, -known.name.length).trim();
    }
  }
  if (!city) {
    const words = street.split(/\s+/);
    if (words.length > 2) {
      city = words[words.length - 1];
      street = words.slice(0, -1).join(" ");
    }
  }
  return { number: Number(m[1]), street, unit, city: city?.trim() || null, postal };
}

export type GeocodeResult = { lat: number; lng: number; postalCode: string | null; city: string; propertyType: string | null };

export interface Geocoder {
  name: string;
  geocode(address: ParsedAddress): Promise<GeocodeResult | null>;
}

export function mapTilerGeocoder(key: string, fetchImpl: typeof fetch = fetch): Geocoder {
  return {
    name: "maptiler",
    async geocode(a) {
      const q = `${a.number} ${a.street}${a.city ? `, ${a.city}` : ""}, ${brand.market.region}`;
      const res = await fetchImpl(`https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${key}&country=${brand.market.country.toLowerCase()}&limit=1&types=address`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { features?: { center: [number, number]; context?: { id: string; text: string }[] }[] };
      const f = body.features?.[0];
      if (!f) return null;
      const city = f.context?.find((c) => c.id.startsWith("municipality") || c.id.startsWith("place"))?.text ?? a.city ?? "";
      const postal = f.context?.find((c) => c.id.startsWith("postal"))?.text ?? a.postal;
      return { lng: f.center[0], lat: f.center[1], city, postalCode: postal ?? null, propertyType: null };
    },
  };
}

/** Places a house number on a known street by interpolating between neighbouring numbers. */
export function localStreetGeocoder(sql: postgres.Sql): Geocoder {
  return {
    name: "local",
    async geocode(a) {
      const street = normalizeStreet(a.street);
      const rows = await sql<{ num: number; lng: number; lat: number; postal: string; city: string; type: string }[]>`
        select split_part(p.address_normalized, ' ', 1)::int as num, ST_X(p.location::geometry) as lng, ST_Y(p.location::geometry) as lat,
          p.postal_code as postal, p.city, p.property_type as type
        from properties p
        where p.address_normalized ~ ${`^[0-9]+ ${street.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( UNIT .*)?$`}
          and (${a.city}::text is null or lower(p.city) = lower(${a.city ?? null}))
        limit 400`;
      if (!rows.length) return null;
      const cities = new Set(rows.map((r) => r.city));
      if (cities.size > 1 && !a.city) return null; // ambiguous without a city
      const sorted = [...rows].sort((x, y) => x.num - y.num);
      const below = [...sorted].reverse().find((r) => r.num <= a.number) ?? sorted[0];
      const above = sorted.find((r) => r.num >= a.number) ?? sorted[sorted.length - 1];
      const t = above.num === below.num ? 0 : (a.number - below.num) / (above.num - below.num);
      const nearest = Math.abs(below.num - a.number) <= Math.abs(above.num - a.number) ? below : above;
      const types = new Map<string, number>();
      for (const r of rows) types.set(r.type, (types.get(r.type) ?? 0) + 1);
      const commonType = [...types.entries()].sort((x, y) => y[1] - x[1])[0][0];
      return {
        lng: below.lng + (above.lng - below.lng) * t,
        lat: below.lat + (above.lat - below.lat) * t,
        postalCode: a.postal ?? nearest.postal,
        city: nearest.city,
        propertyType: a.unit ? "condo" : commonType,
      };
    },
  };
}

export function configuredGeocoder(sql: postgres.Sql): Geocoder {
  const key = process.env.MAPTILER_GEOCODING_KEY;
  if (key && !key.includes("replace")) return mapTilerGeocoder(key);
  return localStreetGeocoder(sql);
}
