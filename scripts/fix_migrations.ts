import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { unquotePostgisTypes } from "./lib/migrations";

// Runs after every `drizzle-kit generate` (see db:generate in package.json).
const dir = resolve(import.meta.dirname, "../src/db/migrations");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
  const path = resolve(dir, file);
  const before = readFileSync(path, "utf8");
  const after = unquotePostgisTypes(before);
  if (after !== before) {
    writeFileSync(path, after);
    console.log(`fixed PostGIS types in ${file}`);
  }
}
