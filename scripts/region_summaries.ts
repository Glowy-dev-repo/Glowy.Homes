import "dotenv/config";
import postgres from "postgres";
import { generateRegionSummaries } from "../src/lib/regions/summary";

// `npx tsx scripts/region_summaries.ts [--force]`: regenerate neighbourhood summaries now.
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const n = await generateRegionSummaries(sql, { force: process.argv.includes("--force") });
console.log(`region summaries written: ${n}`);
await sql.end();
