import "dotenv/config";
import postgres from "postgres";
import { configuredFeedSource, getAdapter } from "../src/lib/ingestion/adapters";
import { runIngest } from "../src/lib/ingestion/ingest";

// Runs ingest_feed outside Inngest for the configured LISTING_FEED (synthetic or simplyrets).
// `--full` ignores the saved cursor and replays the whole feed, which must produce zero creates and
// zero updates on an already ingested database.
const full = process.argv.includes("--full");
const sql = postgres(process.env.DATABASE_URL!, { max: 4, onnotice: () => {} });

const source = configuredFeedSource();
if (source !== "synthetic" && source !== "simplyrets") throw new Error(`No adapter configured for LISTING_FEED=${source}`);

const result = await runIngest(sql, getAdapter(source), { cursor: full ? null : undefined, log: (m) => console.log(m) });
console.log(JSON.stringify({ status: result.status, cursor: result.cursor, stats: result.stats }));
await sql.end();
process.exit(result.status === "failed" ? 1 : 0);
