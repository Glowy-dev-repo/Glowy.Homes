import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __glowyPg: postgres.Sql | undefined;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  return url;
}

// Reuse one pool across hot reloads in dev so connections do not pile up.
const client =
  globalThis.__glowyPg ??
  postgres(connectionString(), { max: process.env.NODE_ENV === "production" ? 5 : 10 });
if (process.env.NODE_ENV !== "production") globalThis.__glowyPg = client;

export const db = drizzle(client, { schema });
export const sqlClient = client;
export { schema };
