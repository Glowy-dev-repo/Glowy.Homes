import "dotenv/config";
import { CITY_DEFS } from "../../src/lib/ingestion/synthetic/market";
import { Rng } from "../../src/lib/random";
import { toQueryString } from "../../src/lib/search/url";
import type { SearchParamsInput } from "../../src/types/search";

// docs/05 Phase 1 criterion 3: search p95 under 300ms for 50 random filter combinations with bounds.
// Default: HTTP against PERF_BASE_URL (the running app). --direct calls the search function in process.

const RUNS = 50;
const P95_BUDGET_MS = 300;
const direct = process.argv.includes("--direct");
const baseUrl = process.env.PERF_BASE_URL ?? "http://localhost:3000";

function randomParams(rng: Rng): SearchParamsInput {
  const city = rng.pick(CITY_DEFS);
  const xs = city.boundary.map((p) => p[0]);
  const ys = city.boundary.map((p) => p[1]);
  const w = rng.range(Math.min(...xs), Math.max(...xs) - 0.02);
  const s = rng.range(Math.min(...ys), Math.max(...ys) - 0.02);
  const span = rng.range(0.03, 0.3);
  const type = rng.bool(0.7) ? "sale" : "rent";
  const p: SearchParamsInput = { type, bounds: [w, s, w + span, s + span * 0.7], sort: rng.pick(["newest", "price_asc", "price_desc", "sqft_desc", "ppsf_asc"] as const) };
  if (rng.bool(0.5)) p.priceMin = type === "sale" ? rng.int(3, 10) * 100_000 : rng.int(15, 25) * 100;
  if (rng.bool(0.5)) p.priceMax = type === "sale" ? rng.int(10, 30) * 100_000 : rng.int(25, 50) * 100;
  if (rng.bool(0.4)) p.bedsMin = rng.int(1, 4);
  if (rng.bool(0.3)) p.bathsMin = rng.int(1, 3);
  if (rng.bool(0.4)) p.propertyTypes = [rng.pick(["condo", "detached", "semi", "townhouse"] as const)];
  if (rng.bool(0.2)) p.status = ["active", "pending"];
  if (rng.bool(0.15)) p.keywords = rng.pick(["fireplace", "balcony", "garage", "hardwood"]);
  if (rng.bool(0.15)) p.yearBuiltMin = rng.int(1960, 2015);
  if (rng.bool(0.15)) p.daysOnMarketMax = rng.pick([7, 14, 30]);
  if (type === "rent" && rng.bool(0.3)) p.pets = true;
  if (rng.bool(0.2)) p.page = rng.int(2, 3);
  return p;
}

async function timeOne(params: SearchParamsInput): Promise<number> {
  const started = performance.now();
  if (direct) {
    const { searchListings } = await import("../../src/lib/search/postgres");
    const { SearchParams } = await import("../../src/types/search");
    await searchListings(SearchParams.parse(params));
  } else {
    const res = await fetch(`${baseUrl}/api/search?${toQueryString(params)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    await res.json();
  }
  return performance.now() - started;
}

const rng = new Rng(Number(process.env.PERF_SEED ?? Date.now() % 100_000));
// Warm up connections and region cache; not measured.
await timeOne(randomParams(new Rng(1)));

const times: number[] = [];
for (let i = 0; i < RUNS; i++) times.push(await timeOne(randomParams(rng)));
times.sort((a, b) => a - b);
const p50 = times[Math.floor(RUNS * 0.5)];
const p95 = times[Math.ceil(RUNS * 0.95) - 1];
console.log(`search ${direct ? "(direct)" : `(http ${baseUrl})`}: runs ${RUNS}, p50 ${p50.toFixed(0)}ms, p95 ${p95.toFixed(0)}ms, max ${times.at(-1)!.toFixed(0)}ms`);
if (direct) (await import("../../src/db")).sqlClient.end();
process.exit(p95 < P95_BUDGET_MS ? 0 : 1);
