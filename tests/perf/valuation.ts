import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

// docs/05 Phase 3 criteria 1 and 2:
//   every active sale listing has a valuation, with insufficient data under 2%;
//   median absolute error against the seed's hidden true value under 8%.
const truthPath = resolve(process.cwd(), "scripts/data/generated/truth.jsonl");
if (!existsSync(truthPath)) throw new Error("truth.jsonl missing: run npm run db:seed");
const truth = new Map<string, number>();
for (const line of readFileSync(truthPath, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const t = JSON.parse(line) as { sourceListingId: string; trueValueNow: number };
  truth.set(t.sourceListingId, t.trueValueNow);
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const rows = await sql<{ sid: string; amount: number | null; low: number | null; high: number | null }[]>`
  select l.source_listing_id as sid, v.amount, v.low, v.high
  from listings l
  left join lateral (
    select amount, low, high from valuations where property_id = l.property_id and kind = 'value'
    order by computed_at desc limit 1
  ) v on true
  where l.listing_type = 'sale' and l.status = 'active' and l.source = 'synthetic'`;
await sql.end();

const missing = rows.filter((r) => r.amount === null).length;
const insufficient = rows.filter((r) => r.amount === 0).length;
const errors = rows
  .filter((r) => r.amount && truth.has(r.sid))
  .map((r) => Math.abs(r.amount! - truth.get(r.sid)!) / truth.get(r.sid)!)
  .sort((a, b) => a - b);
const median = errors[Math.floor(errors.length / 2)];
const inRange = rows.filter((r) => r.amount && truth.has(r.sid) && truth.get(r.sid)! >= r.low! && truth.get(r.sid)! <= r.high!).length / errors.length;
const insufficientRate = (missing + insufficient) / rows.length;

console.log(
  `valuation: ${rows.length} active sale listings, ${missing} without a valuation, ${insufficient} insufficient (${(insufficientRate * 100).toFixed(2)}%), ` +
    `median error ${(median * 100).toFixed(2)}%, true value inside range ${(inRange * 100).toFixed(0)}%`,
);
process.exit(missing === 0 && insufficientRate < 0.02 && median < 0.08 ? 0 : 1);
