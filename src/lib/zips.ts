import { sqlClient } from "@/db";

// ZIP codes in the market, for agents choosing where they receive leads. A ZIP code belongs to the
// city most of its homes are in. Cached briefly: ZIP codes only change when new homes are added.

export type ZipOption = { zip: string; citySlug: string; cityName: string; homes: number };

const TTL_MS = 10 * 60_000;
let cache: { at: number; zips: ZipOption[] } | null = null;

export async function zipOptions(): Promise<ZipOption[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.zips;
  const zips = await sqlClient<ZipOption[]>`
    select distinct on (zip) zip, "citySlug", "cityName", homes from (
      select left(p.postal_code, 5) as zip, c.slug as "citySlug", c.name as "cityName", count(*)::int as homes
      from properties p join regions c on c.id = p.city_region_id
      where p.postal_code ~ '^[0-9]{5}'
      group by 1, 2, 3
    ) z
    order by zip, homes desc`;
  zips.sort((a, b) => a.cityName.localeCompare(b.cityName) || a.zip.localeCompare(b.zip));
  cache = { at: Date.now(), zips };
  return zips;
}
