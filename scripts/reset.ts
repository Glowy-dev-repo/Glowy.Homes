import "dotenv/config";
import postgres from "postgres";

// Drops everything in the target database. Refuses to run against anything but a local database.
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1"].includes(host) && process.env.ALLOW_REMOTE_RESET !== "1") {
  throw new Error(`Refusing to reset non local database at ${host}. Set ALLOW_REMOTE_RESET=1 to override.`);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
await sql.unsafe(`
  DROP SCHEMA IF EXISTS drizzle CASCADE;
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
`);
// PostGIS lives in public, so dropping the schema drops the extension; migration 0000 recreates it.
await sql.end();
console.log(`Database at ${host} reset.`);
