import "dotenv/config";
import postgres from "postgres";
import { backtestAccuracy, nightlyScope, refreshValuations } from "../src/lib/valuation/engine";

// Runs refresh_valuations outside Inngest: market index, nightly scope valuations, then the
// accuracy backtest. Used by the seed and by `npm run valuations`.
const sql = postgres(process.env.DATABASE_URL!, { max: 10, onnotice: () => {} });
const started = Date.now();
const ids = await nightlyScope(sql);
const result = await refreshValuations(sql, ids, {
  refreshIndex: true,
  concurrency: 4,
  log: (m) => process.stdout.write(`\r${m}   `),
});
console.log(`\nvaluations: ${result.valued} properties, ${result.insufficient} with insufficient data, ${((Date.now() - started) / 1000).toFixed(1)}s`);
const scored = await backtestAccuracy(sql);
const [acc] = await sql`
  select count(*)::int as n, percentile_cont(0.5) within group (order by abs_pct_error)::float8 as median,
    avg((abs_pct_error <= 0.05)::int)::float8 as within5, avg((abs_pct_error <= 0.10)::int)::float8 as within10
  from valuation_accuracy where method = 'backtest'`;
console.log(`backtest: ${scored} sales, median error ${(acc.median * 100).toFixed(1)}%, within 5% ${(acc.within5 * 100).toFixed(0)}%, within 10% ${(acc.within10 * 100).toFixed(0)}%`);
await sql.end();
