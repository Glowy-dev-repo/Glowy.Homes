import type postgres from "postgres";
import type { Confidence } from "@/types/valuation";
import { indexLookup, refreshMarketIndexes, type MonthlyIndex } from "./market-index";
import { compsV1, monthsBetween, type CompInput, type Subject, type ValuationModel } from "./model";

// refresh_valuations (docs/03 section 3): gathers subjects and comps from the database, runs the
// model, and stores valuation rows with a comps and inputs snapshot.

type Sql = postgres.Sql;

export const DEFAULT_RENT_YIELD = 0.045;
export const ACCURACY_GUARD = 0.12;
const BATCH = 400;

/** Owner reported condition, applied on top of the comps estimate. */
export const CONDITION_FACTORS: Record<string, number> = { needs_work: 0.9, average: 1, good: 1.03, excellent: 1.07 };

export type SubjectRow = Subject & { id: string; cityId: string | null; condition: string | null; asOf: string };

export type StoredValuation = {
  propertyId: string;
  kind: "value" | "rent";
  amount: number;
  low: number;
  high: number;
  confidence: Confidence;
  insufficientReason?: string;
};

const today = () => new Date().toISOString().slice(0, 10);

/** Subjects with owner overrides merged over feed facts (docs/02 properties.owner_facts_override). */
export async function loadSubjects(sql: Sql, ids: string[], asOf = today()): Promise<SubjectRow[]> {
  if (!ids.length) return [];
  return sql<SubjectRow[]>`
    select p.id, p.property_type as "propertyType", p.city_region_id as "cityId",
      coalesce((p.owner_facts_override->>'sqft')::int, p.sqft) as sqft,
      coalesce((p.owner_facts_override->>'beds')::float8, p.beds::float8) as beds,
      coalesce((p.owner_facts_override->>'baths')::float8, p.baths::float8) as baths,
      coalesce((p.owner_facts_override->>'year_built')::int, p.year_built) as "yearBuilt",
      coalesce((p.owner_facts_override->>'lot_sqft')::int, p.lot_sqft) as "lotSqft",
      p.owner_facts_override->>'condition' as condition,
      ${asOf}::text as "asOf"
    from properties p where p.id = any(${ids}::uuid[])`;
}

type CompRow = CompInput & { subjectId: string };

/** Nearest 60 closed comps per subject within 10 km and 18 months before its as of date. */
export async function loadComps(sql: Sql, subjects: { id: string; asOf: string }[], kind: "value" | "rent"): Promise<Map<string, CompInput[]>> {
  const rows = await sql.unsafe<CompRow[]>(
    `with subj as (
       select x.id, x.as_of, p.location, p.property_type
       from jsonb_to_recordset($1::jsonb) as x(id uuid, as_of date)
       join properties p on p.id = x.id
     )
     select s.id as "subjectId", c.*
     from subj s
     cross join lateral (
       select l.property_id as "propertyId",
         concat_ws(', ', concat_ws(' ', cp.address_line2, cp.address_line1), cp.city) as address,
         l.sold_price as "soldPrice", l.sold_date::text as "soldAt",
         ST_Distance(l.location, s.location)::int as "distanceM",
         l.sqft, l.beds::float8 as beds, l.baths::float8 as baths, cp.year_built as "yearBuilt", cp.lot_sqft as "lotSqft"
       from listings l join properties cp on cp.id = l.property_id
       where l.listing_type = $2 and l.status = $3 and l.property_type = s.property_type
         and l.property_id <> s.id and l.sqft > 0 and l.beds is not null and l.sold_price > 0
         and l.sold_date < s.as_of and l.sold_date >= s.as_of - interval '18 months'
         and ST_DWithin(l.location, s.location, 10000)
       order by l.location <-> s.location
       limit 60
     ) c`,
    [sql.json(subjects.map((s) => ({ id: s.id, as_of: s.asOf }))), kind === "value" ? "sale" : "rent", kind === "value" ? "sold" : "leased"],
  );
  const map = new Map<string, CompInput[]>();
  for (const { subjectId, ...c } of rows) {
    const list = map.get(subjectId) ?? [];
    list.push(c);
    map.set(subjectId, list);
  }
  return map;
}

/** docs/03 step 1: 5 km and 12 months first, widening to 10 km and 18 months below 5 comps. */
export function selectComps(all: CompInput[], asOf: string): CompInput[] {
  const tight = all.filter((c) => c.distanceM <= 5000 && monthsBetween(c.soldAt, asOf) <= 12);
  return tight.length >= 5 ? tight : all;
}

async function cityAccuracy(sql: Sql): Promise<Map<string, number>> {
  const rows = await sql<{ city: string; median: number }[]>`
    select city_region_id as city, percentile_cont(0.5) within group (order by abs_pct_error)::float8 as median
    from valuation_accuracy
    where city_region_id is not null and sold_date >= current_date - 180
    group by 1 having count(*) >= 20`;
  return new Map(rows.map((r) => [r.city, r.median]));
}

type Indexes = Map<string, { sale: MonthlyIndex; rent: MonthlyIndex }>;

export async function loadIndexes(sql: Sql): Promise<Indexes> {
  const rows = await sql<{ id: string; sale: MonthlyIndex | null; rent: MonthlyIndex | null }[]>`
    select id, stats->'ppsf_index' as sale, stats->'rent_ppsf_index' as rent from regions where type = 'city'`;
  return new Map(rows.map((r) => [r.id, { sale: r.sale ?? {}, rent: r.rent ?? {} }]));
}

export type EstimateOutcome = {
  subject: SubjectRow;
  value: StoredValuation;
  rent: StoredValuation;
  valueComps: ReturnType<typeof snapshotComps>;
  rentComps: ReturnType<typeof snapshotComps>;
};

function snapshotComps(comps: { propertyId: string; address: string; soldPrice: number; soldAt: string; distanceM: number; adjustedPrice: number; weight: number; beds: number; baths: number | null; sqft: number }[]) {
  return comps.slice(0, 12).map((c) => ({
    property_id: c.propertyId,
    address: c.address,
    sold_price: c.soldPrice,
    sold_at: c.soldAt,
    distance_m: c.distanceM,
    adj_price: Math.round(c.adjustedPrice),
    weight: Math.round(c.weight * 1000) / 1000,
    beds: c.beds,
    baths: c.baths,
    sqft: c.sqft,
  }));
}

/** Runs the model for a batch of subjects without writing anything. */
export async function estimateSubjects(
  sql: Sql,
  subjects: SubjectRow[],
  opts: { model?: ValuationModel; indexes: Indexes; accuracy?: Map<string, number> },
): Promise<EstimateOutcome[]> {
  const model = opts.model ?? compsV1;
  const [valueComps, rentComps] = await Promise.all([
    loadComps(sql, subjects, "value"),
    loadComps(sql, subjects, "rent"),
  ]);

  const out: EstimateOutcome[] = [];
  for (const s of subjects) {
    const idx = s.cityId ? opts.indexes.get(s.cityId) : undefined;
    const condition = CONDITION_FACTORS[s.condition ?? "average"] ?? 1;
    const guard = s.cityId && (opts.accuracy?.get(s.cityId) ?? 0) > ACCURACY_GUARD;

    const v = await model.estimate({ subject: s, asOf: s.asOf, kind: "value", comps: selectComps(valueComps.get(s.id) ?? [], s.asOf), marketIndex: indexLookup(idx?.sale ?? {}) });
    const value: StoredValuation =
      "insufficientData" in v
        ? { propertyId: s.id, kind: "value", amount: 0, low: 0, high: 0, confidence: "low", insufficientReason: v.reason }
        : {
            propertyId: s.id,
            kind: "value",
            amount: Math.round((v.amount * condition) / 1000) * 1000,
            low: Math.round((v.low * condition) / 1000) * 1000,
            high: Math.round((v.high * condition) / 1000) * 1000,
            confidence: guard ? "low" : v.confidence,
          };

    const r = await model.estimate({ subject: s, asOf: s.asOf, kind: "rent", comps: selectComps(rentComps.get(s.id) ?? [], s.asOf), marketIndex: indexLookup(idx?.rent ?? {}) });
    let rent: StoredValuation;
    if (!("insufficientData" in r)) {
      rent = { propertyId: s.id, kind: "rent", amount: r.amount, low: r.low, high: r.high, confidence: guard ? "low" : r.confidence };
    } else if (value.amount > 0) {
      // docs/03 step 7 fallback: value times regional gross yield, with a wide range.
      const monthly = (value.amount * DEFAULT_RENT_YIELD) / 12;
      const round25 = (n: number) => Math.round(n / 25) * 25;
      rent = { propertyId: s.id, kind: "rent", amount: round25(monthly), low: round25(monthly * 0.85), high: round25(monthly * 1.15), confidence: "low" };
    } else {
      rent = { propertyId: s.id, kind: "rent", amount: 0, low: 0, high: 0, confidence: "low", insufficientReason: r.reason };
    }

    out.push({
      subject: s,
      value,
      rent,
      valueComps: "insufficientData" in v ? [] : snapshotComps(v.comps),
      rentComps: "insufficientData" in r ? [] : snapshotComps(r.comps),
    });
  }
  return out;
}

async function persist(sql: Sql, outcomes: EstimateOutcome[], modelVersion: string) {
  const rows = outcomes.flatMap((o) => {
    const inputs = {
      property_type: o.subject.propertyType,
      sqft: o.subject.sqft,
      beds: o.subject.beds,
      baths: o.subject.baths,
      year_built: o.subject.yearBuilt,
      condition: o.subject.condition,
      as_of: o.subject.asOf,
    };
    return [
      { property_id: o.subject.id, kind: "value", amount: o.value.amount, low: o.value.low, high: o.value.high, confidence: o.value.confidence, comps: o.valueComps, inputs: { ...inputs, insufficient_reason: o.value.insufficientReason } },
      { property_id: o.subject.id, kind: "rent", amount: o.rent.amount, low: o.rent.low, high: o.rent.high, confidence: o.rent.confidence, comps: o.rentComps, inputs: { ...inputs, insufficient_reason: o.rent.insufficientReason } },
    ];
  });
  await sql.unsafe(
    `insert into valuations (property_id, kind, amount, low, high, confidence, model_version, comps, inputs)
     select x.property_id, x.kind, x.amount, x.low, x.high, x.confidence, $2, x.comps, x.inputs
     from jsonb_to_recordset($1::jsonb) as x(property_id uuid, kind text, amount int, low int, high int, confidence text, comps jsonb, inputs jsonb)`,
    [sql.json(rows), modelVersion],
  );
}

/** Values the given properties now and stores the results. Returns counts. */
export async function refreshValuations(
  sql: Sql,
  propertyIds: string[],
  opts: { refreshIndex?: boolean; log?: (m: string) => void; concurrency?: number } = {},
): Promise<{ valued: number; insufficient: number }> {
  if (opts.refreshIndex) await refreshMarketIndexes(sql);
  const [indexes, accuracy] = await Promise.all([loadIndexes(sql), cityAccuracy(sql)]);
  let valued = 0;
  let insufficient = 0;
  const batches: string[][] = [];
  for (let i = 0; i < propertyIds.length; i += BATCH) batches.push(propertyIds.slice(i, i + BATCH));

  // A few batches in flight at once: the work is database bound and spreads across connections.
  const worker = async () => {
    for (let batch = batches.shift(); batch; batch = batches.shift()) {
      const subjects = await loadSubjects(sql, batch);
      const outcomes = await estimateSubjects(sql, subjects, { indexes, accuracy });
      await persist(sql, outcomes, compsV1.version);
      valued += outcomes.length;
      insufficient += outcomes.filter((o) => o.value.amount === 0).length;
      opts.log?.(`valued ${valued} of ${propertyIds.length}`);
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? 3 }, worker));
  return { valued, insufficient };
}

/** docs/03 section 3.3 nightly scope: active listings, claimed homes, and homes viewed in the last 7 days. */
export async function nightlyScope(sql: Sql): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    select distinct property_id as id from listings where status in ('active', 'pending')
    union select id from properties where owner_claimed_at is not null
    union select distinct l.property_id from recently_viewed rv join listings l on l.id = rv.listing_id where rv.viewed_at >= now() - interval '7 days'`;
  return rows.map((r) => r.id);
}

/**
 * Backtest (docs/03 section 3.4 applied to history): for sales in the last `months`, estimate as of
 * 30 days before the sale using only earlier comps, and record the error in valuation_accuracy.
 */
export async function backtestAccuracy(sql: Sql, months = 6): Promise<number> {
  const sales = await sql<{ propertyId: string; listingId: string; cityId: string | null; soldPrice: number; soldDate: string }[]>`
    select l.property_id as "propertyId", l.id as "listingId", l.city_region_id as "cityId", l.sold_price as "soldPrice", l.sold_date::text as "soldDate"
    from listings l
    where l.listing_type = 'sale' and l.status = 'sold' and l.sold_price > 0 and l.sold_date >= current_date - ${months * 30}::int`;
  const indexes = await loadIndexes(sql);
  await sql`delete from valuation_accuracy where method = 'backtest'`;
  let written = 0;
  for (let i = 0; i < sales.length; i += BATCH) {
    const batch = sales.slice(i, i + BATCH);
    const subjects = await loadSubjects(sql, batch.map((b) => b.propertyId));
    const asOfById = new Map(batch.map((b) => [b.propertyId, new Date(Date.parse(b.soldDate) - 30 * 86_400_000).toISOString().slice(0, 10)]));
    const dated = subjects.map((s) => ({ ...s, asOf: asOfById.get(s.id)! }));
    const outcomes = await estimateSubjects(sql, dated, { indexes });
    const rows = outcomes
      .filter((o) => o.value.amount > 0)
      .map((o) => {
        const sale = batch.find((b) => b.propertyId === o.subject.id)!;
        return {
          property_id: sale.propertyId,
          listing_id: sale.listingId,
          city_region_id: sale.cityId,
          sold_price: sale.soldPrice,
          sold_date: sale.soldDate,
          estimate: o.value.amount,
          abs_pct_error: Math.abs(o.value.amount - sale.soldPrice) / sale.soldPrice,
        };
      });
    if (rows.length) {
      await sql.unsafe(
        `insert into valuation_accuracy (property_id, listing_id, city_region_id, sold_price, sold_date, estimate, abs_pct_error, method)
         select x.property_id, x.listing_id, x.city_region_id, x.sold_price, x.sold_date, x.estimate, x.abs_pct_error, 'backtest'
         from jsonb_to_recordset($1::jsonb) as x(property_id uuid, listing_id uuid, city_region_id uuid, sold_price int, sold_date date, estimate int, abs_pct_error numeric)`,
        [sql.json(rows)],
      );
    }
    written += rows.length;
  }
  return written;
}

/** score_valuations (docs/03 section 3.4): sales from the last day against the estimate 30 days earlier. */
export async function scoreRecentSales(sql: Sql): Promise<number> {
  const rows = await sql`
    insert into valuation_accuracy (property_id, listing_id, city_region_id, valuation_id, sold_price, sold_date, estimate, abs_pct_error, method)
    select l.property_id, l.id, l.city_region_id, v.id, l.sold_price, l.sold_date, v.amount,
      abs(v.amount - l.sold_price)::numeric / l.sold_price, 'live'
    from listings l
    cross join lateral (
      select id, amount from valuations
      where property_id = l.property_id and kind = 'value' and amount > 0 and computed_at <= l.sold_date - interval '30 days'
      order by computed_at desc limit 1
    ) v
    where l.status = 'sold' and l.sold_price > 0 and l.sold_date >= current_date - 1
      and not exists (select 1 from valuation_accuracy a where a.listing_id = l.id and a.method = 'live')
    returning id`;
  return rows.length;
}
