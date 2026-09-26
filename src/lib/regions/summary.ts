import type postgres from "postgres";
import { formatNumber, formatPrice } from "@/lib/format";

// Neighbourhood summaries (docs/05 Phase 6 task 3), cached on regions.summary and regenerated
// weekly. They describe the housing stock and the market only: never people, schools, safety or
// anything touching protected grounds (docs/06 fair housing). With an ANTHROPIC_API_KEY the LLM
// rewrites the same facts into prose; the template below is the default and the fallback.

export type SummaryFacts = {
  name: string;
  cityName: string | null;
  saleCount: number;
  rentCount: number;
  medianPrice: number | null;
  cityMedianPrice: number | null;
  medianRent: number | null;
  medianDom: number | null;
  medianYearBuilt: number | null;
  typeMix: { type: string; share: number }[];
};

const TYPE_NOUN: Record<string, string> = { detached: "detached houses", semi: "semi detached houses", townhouse: "townhouses", condo: "condos", multi: "multi unit buildings", land: "lots", other: "other homes" };

export function templateSummary(f: SummaryFacts): string {
  const parts: string[] = [];
  if (f.medianPrice && f.cityMedianPrice && f.cityName) {
    const diff = Math.round(((f.medianPrice - f.cityMedianPrice) / f.cityMedianPrice) * 100);
    const relative = Math.abs(diff) < 5 ? `close to the ${f.cityName} median` : `about ${Math.abs(diff)}% ${diff > 0 ? "above" : "below"} the ${f.cityName} median`;
    parts.push(`The median asking price in ${f.name} is ${formatPrice(f.medianPrice)}, ${relative}.`);
  } else if (f.medianPrice) {
    parts.push(`The median asking price in ${f.name} is ${formatPrice(f.medianPrice)}.`);
  }
  const top = f.typeMix.filter((t) => t.share >= 0.15).slice(0, 2);
  if (top.length) {
    const mix = top.map((t) => `${TYPE_NOUN[t.type] ?? t.type} (${Math.round(t.share * 100)}%)`).join(" and ");
    parts.push(`Most homes listed here are ${mix}${f.medianYearBuilt ? `, and a typical home was built around ${f.medianYearBuilt}` : ""}.`);
  }
  if (f.saleCount || f.rentCount) {
    const rent = f.rentCount && f.medianRent ? ` and ${formatNumber(f.rentCount)} ${f.rentCount === 1 ? "rental" : "rentals"} with a median rent of ${formatPrice(f.medianRent, { listingType: "rent" })}` : "";
    parts.push(`Right now there ${f.saleCount === 1 ? "is" : "are"} ${formatNumber(f.saleCount)} ${f.saleCount === 1 ? "home" : "homes"} for sale${rent}.`);
  }
  if (f.medianDom !== null && f.saleCount) parts.push(`Homes for sale here have typically been listed for about ${f.medianDom} ${f.medianDom === 1 ? "day" : "days"}.`);
  return parts.join(" ") || `${f.name} has no active listings right now.`;
}

/** LLM output must stay within the rules above; anything off script falls back to the template. */
export function acceptableSummary(text: string): boolean {
  if (text.length < 80 || text.length > 900) return false;
  if (/[–—]|\s-\s/.test(text)) return false; // no dashes in copy (CLAUDE.md rule 10)
  return !/\b(?:famil(?:y|ies)|kids|children|young|old(?:er)? people|retirees|seniors|students|immigrants?|ethnic\w*|relig\w*|churche?s?|mosques?|temples?|synagogues?|safe|safety|crime|dangerous|schools?|diverse|diversity|quiet|upscale|exclusive)\b/i.test(text);
}

export async function gatherSummaryFacts(sql: postgres.Sql, regionId: string): Promise<SummaryFacts | null> {
  const [r] = await sql<{ name: string; type: string; stats: Record<string, number>; cityName: string | null; cityStats: Record<string, number> | null }[]>`
    select r.name, r.type, r.stats, p.name as "cityName", p.stats as "cityStats"
    from regions r left join regions p on p.id = r.parent_id and r.type = 'neighborhood'
    where r.id = ${regionId}`;
  if (!r) return null;
  const col = r.type === "city" ? sql`l.city_region_id` : sql`l.neighborhood_region_id`;
  const [mix, [year]] = await Promise.all([
    sql<{ type: string; share: number }[]>`
      select l.property_type as type, count(*)::float8 / sum(count(*)) over () as share
      from listings l where ${col} = ${regionId} and l.status = 'active' and l.listing_type = 'sale'
      group by l.property_type order by share desc`,
    sql<{ year: number | null }[]>`
      select percentile_disc(0.5) within group (order by p.year_built) as year
      from listings l join properties p on p.id = l.property_id
      where ${col} = ${regionId} and l.status = 'active' and p.year_built is not null`,
  ]);
  const num = (v: unknown) => (v === undefined || v === null ? null : Number(v));
  return {
    name: r.name,
    cityName: r.cityName,
    saleCount: num(r.stats.listing_count) ?? 0,
    rentCount: num(r.stats.rent_count) ?? 0,
    medianPrice: num(r.stats.median_price),
    cityMedianPrice: num(r.cityStats?.median_price),
    medianRent: num(r.stats.median_rent),
    medianDom: num(r.stats.median_dom),
    medianYearBuilt: year?.year ?? null,
    typeMix: mix,
  };
}

async function llmSummary(facts: SummaryFacts, apiKey: string): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        "Write a factual two to three sentence summary of a neighbourhood's housing market for a real estate site, using only the facts given. Describe homes and prices only. Never describe the people who live there, schools, safety, or who the area suits. Do not use dashes. Plain text, no headings.",
      messages: [{ role: "user", content: JSON.stringify(facts) }],
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = body.content.find((c) => c.type === "text")?.text?.trim() ?? "";
  return acceptableSummary(text) ? text : null;
}

/** Regenerates summaries older than a week (or all with force). Returns how many were written. */
export async function generateRegionSummaries(sql: postgres.Sql, opts: { force?: boolean; limit?: number } = {}): Promise<number> {
  const stale = await sql<{ id: string }[]>`
    select id from regions where type in ('city', 'neighborhood')
      ${opts.force ? sql`` : sql`and (summary is null or summary_generated_at < now() - interval '7 days')`}
    order by summary_generated_at nulls first limit ${opts.limit ?? 10_000}`;
  const key = process.env.ANTHROPIC_API_KEY;
  const useLlm = !!key && !key.includes("replace");
  let written = 0;
  for (const { id } of stale) {
    const facts = await gatherSummaryFacts(sql, id);
    if (!facts) continue;
    const text = (useLlm ? await llmSummary(facts, key!).catch(() => null) : null) ?? templateSummary(facts);
    await sql`update regions set summary = ${text}, summary_generated_at = now() where id = ${id}`;
    written += 1;
  }
  return written;
}
