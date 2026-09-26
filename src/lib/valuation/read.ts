import { sqlClient } from "@/db";
import type { Confidence, PropertyEstimate, ValuationComp } from "@/types/valuation";
import { addMonths, indexLookup, monthKey } from "./market-index";

type Row = {
  kind: "value" | "rent";
  amount: number;
  low: number;
  high: number;
  confidence: Confidence;
  computedAt: string;
  modelVersion: string;
  comps: {
    property_id: string;
    address?: string;
    sold_price: number;
    sold_at: string;
    distance_m: number;
    adj_price: number;
    weight: number;
    beds?: number | null;
    baths?: number | null;
    sqft?: number | null;
  }[];
  inputs: { insufficient_reason?: string };
};

const LAZY_TTL_DAYS = 30;

/**
 * docs/03 section 3.3: homes outside the nightly scope are valued lazily on first view, then
 * cached for 30 days. Returns the estimate after computing one if it was missing or stale.
 */
export async function getOrComputeEstimate(propertyId: string): Promise<PropertyEstimate> {
  const [latest] = await sqlClient<{ fresh: boolean }[]>`
    select computed_at >= now() - ${`${LAZY_TTL_DAYS} days`}::interval as fresh
    from valuations where property_id = ${propertyId} and kind = 'value'
    order by computed_at desc limit 1`;
  if (!latest?.fresh) {
    const { refreshValuations } = await import("./engine");
    await refreshValuations(sqlClient, [propertyId]);
  }
  return getPropertyEstimate(propertyId);
}

/**
 * Latest value and rent estimate for a property plus a 12 month monthly history
 * (docs/02 GET /api/properties/[id]/valuation). Null estimate fields mean none computed yet.
 */
export async function getPropertyEstimate(propertyId: string): Promise<PropertyEstimate> {
  const [latest, history] = await Promise.all([
    sqlClient<Row[]>`
      select distinct on (kind) kind, amount, low, high, confidence, computed_at::text as "computedAt",
        model_version as "modelVersion", comps, inputs
      from valuations where property_id = ${propertyId}
      order by kind, computed_at desc`,
    sqlClient<{ month: string; amount: number }[]>`
      select to_char(m, 'YYYY-MM') as month, amount from (
        select distinct on (date_trunc('month', computed_at)) date_trunc('month', computed_at) as m, amount
        from valuations
        where property_id = ${propertyId} and kind = 'value' and computed_at >= now() - interval '12 months'
          and confidence is not null
        order by date_trunc('month', computed_at), computed_at desc
      ) x order by m`,
  ]);

  const value = latest.find((r) => r.kind === "value");
  const rent = latest.find((r) => r.kind === "rent");

  // Months with no stored valuation are filled from the current estimate and the city market
  // index, so a newly valued home still shows a 12 month trend.
  if (value && value.amount > 0 && history.length < 12) {
    const [city] = await sqlClient<{ index: Record<string, number> | null }[]>`
      select r.stats->'ppsf_index' as index from properties p join regions r on r.id = p.city_region_id where p.id = ${propertyId}`;
    const lookup = indexLookup(city?.index ?? {});
    const now = monthKey(new Date());
    const nowIdx = lookup(now);
    if (nowIdx) {
      const stored = new Map(history.map((h) => [h.month, h.amount]));
      history.splice(0, history.length);
      for (let i = 11; i >= 0; i--) {
        const m = addMonths(now, -i);
        const idx = lookup(m);
        history.push({ month: m, amount: stored.get(m) ?? Math.round((value.amount * (idx ?? nowIdx)) / nowIdx / 1000) * 1000 });
      }
    }
  }
  const toEstimate = (r: Row | undefined) =>
    r && r.amount > 0 ? { amount: r.amount, low: r.low, high: r.high, confidence: r.confidence, computedAt: r.computedAt } : null;

  const comps: ValuationComp[] = (value?.comps ?? []).map((c) => ({
    propertyId: c.property_id,
    address: c.address ?? "",
    soldPrice: c.sold_price,
    soldAt: c.sold_at,
    distanceM: c.distance_m,
    adjustedPrice: c.adj_price,
    weight: c.weight,
    beds: c.beds ?? null,
    baths: c.baths ?? null,
    sqft: c.sqft ?? null,
  }));

  return {
    value: toEstimate(value),
    rent: toEstimate(rent),
    history,
    comps,
    modelVersion: value?.modelVersion ?? null,
    insufficientReason: value && value.amount <= 0 ? (value.inputs.insufficient_reason ?? "Not enough data") : null,
  };
}
