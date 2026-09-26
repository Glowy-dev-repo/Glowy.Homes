import { sqlClient } from "@/db";
import type { RegionStats } from "@/db/schema/geo";

export type RegionRef = {
  id: string;
  type: "city" | "neighborhood";
  name: string;
  slug: string;
  parentSlug: string | null;
  parentName: string | null;
  stats: RegionStats;
  bbox: [number, number, number, number] | null;
};

// Region lookups are hot (every search with city=) and regions change only on reseed, so a
// short in memory cache is plenty.
const TTL_MS = 5 * 60_000;
let cache: { at: number; regions: RegionRef[] } | null = null;

export async function allRegions(): Promise<RegionRef[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.regions;
  const rows = await sqlClient<
    (Omit<RegionRef, "bbox"> & { xmin: number | null; ymin: number | null; xmax: number | null; ymax: number | null })[]
  >`
    select r.id, r.type, r.name, r.slug, r.stats,
      case when r.type = 'neighborhood' then p.slug end as "parentSlug",
      case when r.type = 'neighborhood' then p.name end as "parentName",
      ST_XMin(r.boundary::geometry) as xmin, ST_YMin(r.boundary::geometry) as ymin,
      ST_XMax(r.boundary::geometry) as xmax, ST_YMax(r.boundary::geometry) as ymax
    from regions r left join regions p on p.id = r.parent_id
    where r.type in ('city', 'neighborhood')
    order by r.type, r.name`;
  const regions = rows.map(({ xmin, ymin, xmax, ymax, ...r }) => ({
    ...r,
    bbox: xmin === null ? null : ([xmin, ymin, xmax, ymax] as [number, number, number, number]),
  }));
  cache = { at: Date.now(), regions };
  return regions;
}

export async function findCity(slug: string): Promise<RegionRef | null> {
  return (await allRegions()).find((r) => r.type === "city" && r.slug === slug) ?? null;
}

export async function findNeighborhood(citySlug: string | undefined, slug: string): Promise<RegionRef | null> {
  const regions = await allRegions();
  return regions.find((r) => r.type === "neighborhood" && r.slug === slug && (!citySlug || r.parentSlug === citySlug)) ?? null;
}

export async function neighborhoodsOf(citySlug: string): Promise<RegionRef[]> {
  return (await allRegions()).filter((r) => r.type === "neighborhood" && r.parentSlug === citySlug);
}

/** Simplified outline rings ([lng, lat][]) for a region, for static SVG previews. */
export async function regionOutline(id: string): Promise<[number, number][][]> {
  const [row] = await sqlClient<{ geojson: { type: string; coordinates: unknown } | null }[]>`
    select ST_AsGeoJSON(ST_SimplifyPreserveTopology(boundary::geometry, 0.001), 5)::json as geojson
    from regions where id = ${id}`;
  const g = row?.geojson;
  if (!g) return [];
  if (g.type === "Polygon") return [(g.coordinates as [number, number][][])[0]];
  if (g.type === "MultiPolygon") return (g.coordinates as [number, number][][][]).map((poly) => poly[0]);
  return [];
}

export function clearRegionCache() {
  cache = null;
}
