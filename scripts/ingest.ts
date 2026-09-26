import "dotenv/config";
import postgres from "postgres";
import { syntheticAdapter } from "../src/lib/ingestion/adapters/synthetic";
import { runIngest } from "../src/lib/ingestion/ingest";

// Runs ingest_feed outside Inngest. `--full` ignores the saved cursor and replays the whole feed,
// which must produce zero creates and zero updates on an already ingested database.
const full = process.argv.includes("--full");
const sql = postgres(process.env.DATABASE_URL!, { max: 4, onnotice: () => {} });

const source = process.env.LISTING_FEED ?? "synthetic";
if (source !== "synthetic") throw new Error(`No adapter configured for LISTING_FEED=${source}`);

const result = await runIngest(sql, syntheticAdapter(), { cursor: full ? null : undefined, log: () => {} });
console.log(JSON.stringify({ status: result.status, cursor: result.cursor, stats: result.stats }));
await sql.end();
process.exit(result.status === "failed" ? 1 : 0);
