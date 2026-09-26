import type postgres from "postgres";

// market_index(city, month): median sold price per sqft per city per month, from price events
// (docs/03 section 3.2). Missing months are linearly interpolated; a centerd three month moving
// average smooths small monthly samples. Stored in regions.stats.ppsf_index (and rent_ppsf_index).

export type MonthlyIndex = Record<string, number>;

export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return monthKey(d);
}

/** Fills gaps between known months by linear interpolation and smooths with a 3 month average. */
export function buildIndex(raw: Record<string, number>, from: string, to: string): MonthlyIndex {
  const months: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) months.push(m);
  const known = months.filter((m) => raw[m] !== undefined && raw[m] > 0);
  if (!known.length) return {};

  const filled: number[] = months.map((m) => {
    if (raw[m] !== undefined && raw[m] > 0) return raw[m];
    const before = [...known].reverse().find((k) => k < m);
    const after = known.find((k) => k > m);
    if (!before) return raw[after!];
    if (!after) return raw[before];
    const span = months.indexOf(after) - months.indexOf(before);
    const pos = months.indexOf(m) - months.indexOf(before);
    return raw[before] + ((raw[after] - raw[before]) * pos) / span;
  });

  const out: MonthlyIndex = {};
  months.forEach((m, i) => {
    const window = filled.slice(Math.max(0, i - 1), Math.min(filled.length, i + 2));
    out[m] = Math.round((window.reduce((s, v) => s + v, 0) / window.length) * 100) / 100;
  });
  return out;
}

/** Index lookup that clamps to the nearest known month outside the covered range. */
export function indexLookup(index: MonthlyIndex): (month: string) => number | null {
  const months = Object.keys(index).sort();
  if (!months.length) return () => null;
  return (month) => {
    if (index[month] !== undefined) return index[month];
    if (month < months[0]) return index[months[0]];
    return index[months[months.length - 1]];
  };
}

/** Recomputes sale and rent indexes for every city; returns them keyed by city region id. */
export async function refreshMarketIndexes(sql: postgres.Sql, asOf = new Date()): Promise<Map<string, { sale: MonthlyIndex; rent: MonthlyIndex }>> {
  const rows = await sql<{ city: string; kind: string; month: string; ppsf: number }[]>`
    select l.city_region_id as city, e.event_type as kind, to_char(e.event_date, 'YYYY-MM') as month,
      percentile_cont(0.5) within group (order by e.price::float8 / l.sqft) as ppsf
    from listing_price_events e
    join listings l on l.id = e.listing_id
    where e.event_type in ('sold', 'leased') and e.price > 0 and l.sqft > 0 and l.city_region_id is not null
      and e.event_date >= ${new Date(asOf.getTime() - 36 * 30.4375 * 86_400_000)}
    group by 1, 2, 3`;

  const to = monthKey(asOf);
  const from = addMonths(to, -35);
  const byCity = new Map<string, { sale: Record<string, number>; rent: Record<string, number> }>();
  for (const r of rows) {
    const entry = byCity.get(r.city) ?? { sale: {}, rent: {} };
    (r.kind === "sold" ? entry.sale : entry.rent)[r.month] = r.ppsf;
    byCity.set(r.city, entry);
  }

  const result = new Map<string, { sale: MonthlyIndex; rent: MonthlyIndex }>();
  for (const [city, raw] of byCity) {
    const sale = buildIndex(raw.sale, from, to);
    const rent = buildIndex(raw.rent, from, to);
    result.set(city, { sale, rent });
    await sql`
      update regions set stats = stats || ${sql.json({ ppsf_index: sale, rent_ppsf_index: rent, index_updated_at: new Date().toISOString() })}
      where id = ${city}`;
  }
  return result;
}
