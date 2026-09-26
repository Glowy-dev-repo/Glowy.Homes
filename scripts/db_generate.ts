import { spawnSync } from "node:child_process";

// `npm run db:generate -- --name=foo`: forwards arguments to drizzle-kit, then fixes PostGIS quoting.
const args = process.argv.slice(2);
const gen = spawnSync("npx", ["drizzle-kit", "generate", ...args], { stdio: "inherit", shell: true });
if (gen.status !== 0) process.exit(gen.status ?? 1);
const fix = spawnSync("npx", ["tsx", "scripts/fix_migrations.ts"], { stdio: "inherit", shell: true });
process.exit(fix.status ?? 1);
