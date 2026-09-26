import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __glowyPg: { orm: postgres.Sql; raw: postgres.Sql } | undefined;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  return url;
}

// Two pools on purpose: drizzle replaces its client's json serializers with a pass through
// (it stringifies itself), which would break sql.json() in raw queries sharing that client.
// Reused across hot reloads in dev so connections do not pile up.
const prod = process.env.NODE_ENV === "production";
const clients = globalThis.__glowyPg ?? {
  orm: postgres(connectionString(), { max: prod ? 4 : 5 }),
  raw: postgres(connectionString(), { max: prod ? 6 : 8, onnotice: () => {} }),
};
if (!prod) globalThis.__glowyPg = clients;

export const db = drizzle(clients.orm, { schema });
/** Raw postgres.js client for PostGIS and bulk queries; sql.json() works as documented here. */
export const sqlClient = clients.raw;
export { schema };
