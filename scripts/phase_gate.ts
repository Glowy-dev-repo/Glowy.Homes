import "dotenv/config";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import postgres from "postgres";

// Phase gate (docs/05): lint, typecheck, unit tests, build, e2e against a production server,
// then phase specific checks. Prints check, status, duration. Exits 1 on any failure.
// Usage: npm run phase:gate -- --phase N

type Result = { check: string; ok: boolean; ms: number; note?: string };
const results: Result[] = [];

const phaseArg = process.argv.indexOf("--phase");
const phase = phaseArg >= 0 ? Number(process.argv[phaseArg + 1]) : null;
const PORT = Number(process.env.GATE_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;
const isWin = process.platform === "win32";

type EnvOverrides = Record<string, string>;

function run(cmd: string, env: EnvOverrides = {}): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolveRun) => {
    const child = spawn(cmd, { shell: true, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const onData = (d: Buffer) => {
      output += d.toString();
      process.stdout.write(d);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("close", (code) => resolveRun({ ok: code === 0, output }));
  });
}

async function step(check: string, fn: () => Promise<boolean | { ok: boolean; note?: string }>) {
  console.log(`\n=== ${check} ===`);
  const start = Date.now();
  let ok = false;
  let note: string | undefined;
  try {
    const r = await fn();
    ok = typeof r === "boolean" ? r : r.ok;
    note = typeof r === "boolean" ? undefined : r.note;
  } catch (err) {
    note = err instanceof Error ? err.message : String(err);
  }
  results.push({ check, ok, ms: Date.now() - start, note });
  return ok;
}

const cmd = (c: string, env?: EnvOverrides) => async () => (await run(c, env)).ok;

function killTree(child: ChildProcess) {
  if (!child.pid) return;
  if (isWin) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else process.kill(-child.pid, "SIGTERM");
}

async function waitForServer(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// ---------- phase specific checks ----------

/** Phase 0: every migration applies cleanly to a brand new empty database. */
async function migrationsOnEmptyDatabase() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const name = `glowy_gate_${Date.now()}`;
  const admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
  await admin.unsafe(`CREATE DATABASE ${name}`);
  try {
    const target = new URL(url);
    target.pathname = `/${name}`;
    const { ok } = await run("npx drizzle-kit migrate", { DATABASE_URL: target.toString() });
    if (!ok) return { ok: false, note: "drizzle-kit migrate failed on an empty database" };
    const check = postgres(target.toString(), { max: 1 });
    const [{ count }] = await check`select count(*)::int as count from pg_tables where schemaname = 'public' and tablename <> 'spatial_ref_sys'`;
    await check.end();
    return { ok: count === 23, note: `${count} tables` };
  } finally {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  }
}

const PHASE_CHECKS: Record<number, { name: string; fn: () => Promise<boolean | { ok: boolean; note?: string }> }[]> = {
  0: [{ name: "migrations apply to empty database", fn: migrationsOnEmptyDatabase }],
};

// ---------- main ----------

async function main() {
  await step("lint", cmd("npm run lint"));
  await step("typecheck", cmd("npm run typecheck"));
  await step("unit tests", cmd("npm run test"));
  const built = await step("build", cmd("npm run build"));

  const portBusy = await fetch(BASE_URL).then(
    () => true,
    () => false,
  );
  if (built && portBusy) {
    results.push({ check: "e2e", ok: false, ms: 0, note: `port ${PORT} already in use; stop that server or set GATE_PORT` });
  } else if (built) {
    const server = spawn(`npx next start -p ${PORT}`, {
      shell: true,
      detached: !isWin,
      env: { ...process.env, EMAIL_TRANSPORT: "log", NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout?.on("data", (d: Buffer) => process.stdout.write(`[server] ${d}`));
    server.stderr?.on("data", (d: Buffer) => process.stdout.write(`[server] ${d}`));
    try {
      await step("e2e", async () => {
        if (!(await waitForServer(BASE_URL, 60_000))) return { ok: false, note: "server did not start" };
        return (await run("npx playwright test", { E2E_BASE_URL: BASE_URL, CI: "1" })).ok;
      });
    } finally {
      killTree(server);
    }
  } else {
    results.push({ check: "e2e", ok: false, ms: 0, note: "skipped: build failed" });
  }

  if (phase !== null) {
    const checks = PHASE_CHECKS[phase];
    if (!checks) {
      results.push({ check: `phase ${phase} checks`, ok: false, ms: 0, note: "no checks defined for this phase yet" });
    } else {
      for (const c of checks) await step(`phase ${phase}: ${c.name}`, c.fn);
    }
  }

  const pass = results.every((r) => r.ok);
  const width = Math.max(...results.map((r) => r.check.length), 5);
  console.log(`\n${"check".padEnd(width)}  status  duration  note`);
  console.log(`${"-".repeat(width)}  ------  --------  ----`);
  for (const r of results) {
    console.log(
      `${r.check.padEnd(width)}  ${(r.ok ? "PASS" : "FAIL").padEnd(6)}  ${`${(r.ms / 1000).toFixed(1)}s`.padStart(8)}  ${r.note ?? ""}`,
    );
  }
  console.log(`\nPHASE GATE${phase !== null ? ` ${phase}` : ""}: ${pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
