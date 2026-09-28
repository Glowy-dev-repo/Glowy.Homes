import "dotenv/config";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import postgres from "postgres";

// Phase gate (docs/05): lint, typecheck, unit tests, build, e2e against a production server,
// then phase specific checks. Prints check, status, duration. Exits 1 on any failure.
// Usage: npm run phase:gate -- --phase N

type Result = { check: string; ok: boolean; ms: number; note?: string };
const results: Result[] = [];
let buildOutput = "";

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

const INNGEST_URL = "http://localhost:8288";

/** Starts the Inngest dev server pointed at the app and waits until it has synced the functions. */
async function startInngestDevServer(appUrl: string): Promise<ChildProcess | null> {
  if (await fetch(INNGEST_URL).then(() => true, () => false)) {
    console.log("[jobs] an Inngest dev server is already running on 8288; using it");
    return null;
  }
  const child = spawn(`npx --yes inngest-cli@latest dev -u ${appUrl} --no-discovery`, { shell: true, detached: !isWin, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.on("data", () => {});
  child.stderr?.on("data", () => {});
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${INNGEST_URL}/v0/gql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{ functions { id } }" }),
      });
      const body = (await res.json()) as { data?: { functions?: unknown[] } };
      if ((body.data?.functions?.length ?? 0) > 0) {
        console.log(`[jobs] Inngest dev server ready with ${body.data!.functions!.length} functions`);
        return child;
      }
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("[jobs] Inngest dev server did not sync in time");
  return child;
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
    // Phase 0 creates 23 tables; later phases add more through their own migrations.
    return { ok: count >= 23, note: `${count} tables` };
  } finally {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  }
}

async function dbCount(query: string): Promise<number> {
  const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  try {
    const [{ n }] = await sql.unsafe<{ n: number }[]>(`select (${query})::int as n`);
    return n;
  } finally {
    await sql.end();
  }
}

/** Phase 1 criterion 1: the seed produced 50,000 listings. */
async function seedCount() {
  const listings = await dbCount("select count(*) from listings");
  const properties = await dbCount("select count(*) from properties");
  return { ok: listings === 50_000 && properties === 50_000, note: `${listings} listings, ${properties} properties (run npm run db:seed if not 50000)` };
}

/** Phase 1 criterion 2: replaying the whole feed creates and updates nothing. */
async function ingestIdempotent() {
  const before = await dbCount("select (select count(*) from listings) + (select count(*) from listing_price_events) + (select count(*) from listing_media) + (select count(*) from properties)");
  const { ok, output } = await run("npx tsx scripts/ingest.ts --full");
  const line = output.split("\n").find((l) => l.startsWith("{"));
  const stats = line ? (JSON.parse(line) as { stats: { created: number; updated: number; unchanged: number } }).stats : null;
  const after = await dbCount("select (select count(*) from listings) + (select count(*) from listing_price_events) + (select count(*) from listing_media) + (select count(*) from properties)");
  return {
    ok: ok && !!stats && stats.created === 0 && stats.updated === 0 && before === after,
    note: stats ? `created ${stats.created}, updated ${stats.updated}, unchanged ${stats.unchanged}, rows ${before} -> ${after}` : "no stats",
  };
}

/** Phase 1 criterion 3: p95 under 300ms over HTTP against the running production build. */
async function searchPerf(ctx: Ctx) {
  const { ok, output } = await run("npx tsx tests/perf/search.ts", { PERF_BASE_URL: ctx.baseUrl });
  return { ok, note: output.trim().split("\n").filter((l) => l.startsWith("search")).at(-1) };
}

/** Phase 1 criterion 6: the city browse page scores 100 on Lighthouse SEO. */
async function citySeo(ctx: Ctx) {
  const { runLighthouse } = await import("./lib/lighthouse");
  const { scores, failing } = await runLighthouse(`${ctx.baseUrl}/homes/toronto`, ["seo"]);
  return { ok: scores.seo === 100, note: `SEO ${scores.seo}${failing.length ? `, failing: ${failing.join(", ")}` : ""}` };
}

/** Phase 2 criterion 1: LDP Lighthouse mobile performance at least 90 and accessibility at least 95. */
async function ldpLighthouse(ctx: Ctx) {
  const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  const [row] = await sql<{ id: string }[]>`
    select id from listings where listing_type = 'sale' and status = 'active' order by list_date desc, id limit 1`;
  await sql.end();
  // The bare id route redirects to the canonical slug, which Lighthouse follows.
  const res = await fetch(`${ctx.baseUrl}/listing/${row.id}`, { redirect: "manual" });
  const url = new URL(res.headers.get("location") ?? `/listing/${row.id}`, ctx.baseUrl).toString();
  await fetch(url); // warm the ISR cache so the audit measures the cached page
  const { runLighthouseMedian } = await import("./lib/lighthouse");
  const { scores, failing, all } = await runLighthouseMedian(url, ["performance", "accessibility"]);
  return {
    ok: scores.performance >= 90 && scores.accessibility >= 95,
    note: `median perf ${scores.performance} (runs ${all.join(", ")}), a11y ${scores.accessibility}${failing.length ? `, failing: ${failing.join(", ")}` : ""}`,
  };
}

/** Phase 2 criterion 5: similar homes coverage across all active listings. */
async function similarCoverage() {
  const { ok, output } = await run("npx tsx tests/perf/similar.ts");
  return { ok, note: output.trim().split("\n").filter((l) => l.startsWith("similar")).at(-1) };
}

/** Phase 3 criteria 1 and 2: coverage (insufficient under 2%) and accuracy against the hidden truth. */
async function valuationCoverage() {
  const { ok, output } = await run("npx tsx tests/perf/valuation.ts");
  return { ok, note: output.trim().split("\n").filter((l) => l.startsWith("valuation")).at(-1) };
}

/** Phase 3 gate: no page shows an estimate without its range, confidence and disclaimer. */
async function disclaimerPresence(ctx: Ctx) {
  const { ok, output } = await run("npx tsx tests/perf/disclaimers.ts", { PERF_BASE_URL: ctx.baseUrl });
  return { ok, note: output.trim().split("\n").filter((l) => l.startsWith("disclaimers")).at(-1) };
}

/** Phase 4 criterion 2: the routing scenario tests. */
async function routingScenarios() {
  const { ok, output } = await run("npx vitest run tests/unit/routing.test.ts");
  return { ok, note: output.match(/Tests\s+(\d+ passed[^\n]*)/)?.[1]?.trim() };
}

/** Phase 4 criterion 4: an agent with no ZIP codes never receives a lead. */
async function noAreaNoLeads() {
  const n = await dbCount(`
    select count(*) from leads l join pros p on p.id = l.assigned_pro_id
    where p.pro_type = 'agent' and not exists (select 1 from pro_zip_codes z where z.pro_id = p.id)
      and coalesce(l.payload->>'requested_pro_id', '') <> p.id::text`);
  const pros = await dbCount(`select count(*) from pros p where p.pro_type = 'agent' and not exists (select 1 from pro_zip_codes z where z.pro_id = p.id)`);
  return { ok: n === 0 && pros > 0, note: `${pros} agents without ZIP codes, ${n} leads routed to them` };
}

/**
 * Phase 5 criteria 1 and 2 against the database after the e2e run: every live user listing went
 * through an approved moderation item, none has fewer than 3 photos, and the flow ran at least once.
 */
async function moderationFlow() {
  const live = await dbCount(`select count(*) from listings where source in ('fsbo', 'landlord') and status = 'active'`);
  const unmoderated = await dbCount(`
    select count(*) from listings l where l.source in ('fsbo', 'landlord') and l.status <> 'in_review'
      and not exists (select 1 from moderation_items m where m.item_type = 'listing' and m.item_id = l.id and m.status in ('approved', 'rejected'))`);
  const thin = await dbCount(`
    select count(*) from listings l where l.source in ('fsbo', 'landlord')
      and (select count(*) from listing_media m where m.listing_id = l.id and m.kind = 'photo') < 3`);
  return { ok: live > 0 && unmoderated === 0 && thin === 0, note: `${live} live user listings, ${unmoderated} skipped moderation, ${thin} under 3 photos` };
}

/** The last output line starting with `prefix`: the summary line each perf script prints. */
function lastLine(output: string, prefix: string): string | undefined {
  return output.trim().split(/\r?\n/).filter((l) => l.startsWith(prefix)).at(-1);
}

/** Phase 6 criterion 5: every docs/01 route answers 200 or the right redirect. */
async function allRoutes(ctx: Ctx) {
  const { ok, output } = await run("npx tsx tests/perf/routes.ts", { PERF_BASE_URL: ctx.baseUrl });
  return { ok, note: lastLine(output, "routes") };
}

/** Phase 6 task 6: first load JS under 250 KB on search and the LDP, read from the build output. */
async function bundleSize() {
  const BUDGET_KB = 250;
  const routes = ["/search", "/listing/[id]/[slug]"];
  const sizes = routes.map((r) => {
    // Build output rows look like "├ ƒ /search   13.9 kB   215 kB"; the last number is first load JS.
    const row = buildOutput.split(/\r?\n/).find((l) => /^[├└┌]/.test(l) && l.split(/\s+/)[2] === r);
    const m = row?.match(/([\d.]+) kB\s*$/);
    return { route: r, kb: m ? Number(m[1]) : null };
  });
  const ok = sizes.every((x) => x.kb !== null && x.kb < BUDGET_KB);
  return { ok, note: sizes.map((x) => `${x.route} ${x.kb ?? "?"} KB`).join(", ") + ` (budget ${BUDGET_KB} KB)` };
}

/** Phase 6 criterion 4: npm audit shows no critical or high vulnerabilities. */
async function audit() {
  const { output } = await run("npm audit --json");
  const counts = (JSON.parse(output.slice(output.indexOf("{"))) as { metadata: { vulnerabilities: Record<string, number> } }).metadata.vulnerabilities;
  return { ok: counts.high === 0 && counts.critical === 0, note: `critical ${counts.critical}, high ${counts.high}, moderate ${counts.moderate}, low ${counts.low}` };
}

/** Phase 6 criterion 1: daily alerts send exactly once per saved search, with a test clock. */
async function alertsOnce() {
  const { ok, output } = await run("npx tsx --require ./scripts/lib/allow-server-only.cjs tests/perf/alerts.ts");
  return { ok, note: lastLine(output, "alerts") };
}

/** Phase 6 criterion 2: 9 of 10 natural language fixtures parse correctly. */
async function nlSearch() {
  const { ok, output } = await run("npx tsx --require ./scripts/lib/allow-server-only.cjs tests/perf/nl-search.ts");
  return { ok, note: lastLine(output, "nl-search") };
}

/** Phase 6 criterion 3 (CLAUDE.md section 9 item 10): search page mobile performance at least 85. */
async function searchLighthouse(ctx: Ctx) {
  const url = `${ctx.baseUrl}/search?city=toronto`;
  await fetch(url);
  const { runLighthouseMedian } = await import("./lib/lighthouse");
  const { scores, failing, all } = await runLighthouseMedian(url, ["performance", "accessibility"]);
  return {
    ok: scores.performance >= 85 && scores.accessibility >= 95,
    note: `median perf ${scores.performance} (runs ${all.join(", ")}), a11y ${scores.accessibility}${failing.length ? `, failing: ${failing.join(", ")}` : ""}`,
  };
}

type Ctx = { baseUrl: string };
type Check = { name: string; fn: (ctx: Ctx) => Promise<boolean | { ok: boolean; note?: string }> };

const PHASE_CHECKS: Record<number, Check[]> = {
  0: [{ name: "migrations apply to empty database", fn: migrationsOnEmptyDatabase }],
  1: [
    { name: "seed count is 50,000", fn: seedCount },
    { name: "ingest replay is idempotent", fn: ingestIdempotent },
    { name: "search p95 under 300ms", fn: searchPerf },
    { name: "Lighthouse SEO 100 on /homes/toronto", fn: citySeo },
  ],
  2: [
    { name: "LDP Lighthouse perf 90 and a11y 95", fn: ldpLighthouse },
    { name: "similar homes for 95% of active listings", fn: similarCoverage },
  ],
  3: [
    { name: "valuation coverage and accuracy", fn: valuationCoverage },
    { name: "disclaimer presence on estimate pages", fn: disclaimerPresence },
  ],
  4: [
    { name: "routing scenario tests", fn: routingScenarios },
    { name: "agents without ZIP codes get no leads", fn: noAreaNoLeads },
  ],
  5: [
    { name: "user listings pass moderation with 3+ photos", fn: moderationFlow },
    { name: "moderation and schema unit tests", fn: async () => (await run("npx vitest run tests/unit/user-listings.test.ts")).ok },
  ],
  6: [
    { name: "all routes 200 or redirect", fn: allRoutes },
    { name: "first load JS under 250 KB", fn: bundleSize },
    { name: "npm audit: no high or critical", fn: audit },
    { name: "daily alert sends exactly once", fn: alertsOnce },
    { name: "natural language search 9 of 10", fn: nlSearch },
    { name: "search Lighthouse perf 85 and a11y 95", fn: searchLighthouse },
    { name: "LDP Lighthouse perf 90 and a11y 95", fn: ldpLighthouse },
  ],
};

async function runPhaseChecks(ctx: Ctx) {
  if (phase === null) return;
  const checks = PHASE_CHECKS[phase];
  if (!checks) {
    results.push({ check: `phase ${phase} checks`, ok: false, ms: 0, note: "no checks defined for this phase yet" });
    return;
  }
  for (const c of checks) await step(`phase ${phase}: ${c.name}`, () => c.fn(ctx));
}

// ---------- main ----------

async function main() {
  await step("lint", cmd("npm run lint"));
  await step("typecheck", cmd("npm run typecheck"));
  await step("unit tests", cmd("npm run test"));
  const built = await step("build", async () => {
    const r = await run("npm run build");
    buildOutput = r.output;
    return r.ok;
  });

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
      env: {
        ...process.env,
        EMAIL_TRANSPORT: "log",
        NODE_ENV: "production",
        // Tests and the perf script send far more than 60 requests a minute from one IP.
        RATE_LIMIT_PER_MINUTE: "100000",
        SIGNIN_EMAILS_PER_HOUR: "100000",
        // Shortened lead timers so reassignment is testable (docs/05 Phase 4 criterion 3).
        LEAD_REASSIGN_SECONDS: process.env.LEAD_REASSIGN_SECONDS ?? "45",
        LEAD_RETRY_SECONDS: process.env.LEAD_RETRY_SECONDS ?? "30",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout?.on("data", (d: Buffer) => process.stdout.write(`[server] ${d}`));
    server.stderr?.on("data", (d: Buffer) => process.stdout.write(`[server] ${d}`));
    let jobs: ChildProcess | null = null;
    try {
      const up = await waitForServer(BASE_URL, 60_000);
      // The Inngest dev server runs background jobs (lead routing) against the test build.
      if (up) jobs = await startInngestDevServer(`${BASE_URL}/api/inngest`);
      await step("e2e", async () => {
        if (!up) return { ok: false, note: "server did not start" };
        return (await run("npx playwright test", { E2E_BASE_URL: BASE_URL, CI: "1" })).ok;
      });
      // Phase checks run while the production server is up, so they measure the real app.
      await runPhaseChecks({ baseUrl: BASE_URL });
    } finally {
      if (jobs) killTree(jobs);
      killTree(server);
    }
  } else {
    results.push({ check: "e2e", ok: false, ms: 0, note: "skipped: build failed" });
    await runPhaseChecks({ baseUrl: BASE_URL });
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
