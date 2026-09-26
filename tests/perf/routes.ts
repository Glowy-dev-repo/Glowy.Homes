import "dotenv/config";
import postgres from "postgres";

// docs/05 Phase 6 criterion 5: every route in docs/01 section 5 exists and returns 200 or a
// correct redirect, checked signed out against a running build (PERF_BASE_URL).

const base = process.env.PERF_BASE_URL ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });

type Expect = { path: string; status: 200 } | { path: string; redirectTo: RegExp };

const slug = (...parts: (string | null)[]) => parts.filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function samples() {
  const [hood] = await sql<{ slug: string }[]>`select n.slug from regions n join regions c on c.id = n.parent_id where c.slug = 'toronto' and n.type = 'neighborhood' order by n.slug limit 1`;
  const [l] = await sql<{ id: string; line1: string; line2: string | null; city: string }[]>`
    select l.id, p.address_line1 as line1, p.address_line2 as line2, p.city from listings l join properties p on p.id = l.property_id
    where l.status = 'active' order by l.list_date desc, l.id limit 1`;
  const [prop] = await sql<{ id: string; line1: string; line2: string | null; city: string }[]>`
    select p.id, p.address_line1 as line1, p.address_line2 as line2, p.city from properties p
    where not exists (select 1 from listings l where l.property_id = p.id and l.status = 'active') and p.city_region_id is not null limit 1`;
  const [agent] = await sql<{ slug: string }[]>`select slug from pros where status = 'active' and pro_type = 'agent' order by slug limit 1`;
  return { hood: hood.slug, listing: { id: l.id, slug: slug(l.line1, l.line2, l.city) }, prop: { id: prop.id, slug: slug(prop.line1, prop.line2, prop.city) }, agent: agent.slug };
}

async function main() {
  const s = await samples();
  const signin = /^\/signin\?callbackUrl=/;
  const routes: Expect[] = [
    { path: "/", status: 200 },
    { path: "/homes/toronto", status: 200 },
    { path: `/homes/toronto/${s.hood}`, status: 200 },
    { path: "/rentals/toronto", status: 200 },
    { path: "/search?city=toronto", status: 200 },
    { path: "/search?type=rent&city=toronto", status: 200 },
    { path: `/listing/${s.listing.id}/${s.listing.slug}`, status: 200 },
    { path: `/listing/${s.listing.id}`, redirectTo: new RegExp(`^/listing/${s.listing.id}/${s.listing.slug}$`) },
    { path: "/home-value", status: 200 },
    { path: `/home-value/${s.prop.id}/${s.prop.slug}`, status: 200 },
    { path: "/sell", status: 200 },
    { path: "/sell/list", redirectTo: signin },
    { path: "/mortgage", status: 200 },
    { path: "/mortgage/preapproval", status: 200 },
    { path: "/agents/toronto", status: 200 },
    { path: `/agent/${s.agent}`, status: 200 },
    { path: "/account", redirectTo: signin },
    { path: "/account/homes", redirectTo: signin },
    { path: "/account/shared", redirectTo: signin },
    { path: "/pro", status: 200 },
    { path: "/pro/leads", redirectTo: signin },
    { path: "/pro/listings", redirectTo: signin },
    { path: "/pro/profile", redirectTo: signin },
    { path: "/landlord", redirectTo: signin },
    { path: "/landlord/listings/new", redirectTo: signin },
    { path: "/admin", redirectTo: signin },
    { path: "/admin/leads", redirectTo: signin },
    { path: "/admin/moderation", redirectTo: signin },
    { path: "/admin/funnel", redirectTo: signin },
    // Pages linked from the header and footer.
    { path: "/methodology", status: 200 },
    { path: "/about", status: 200 },
    { path: "/terms", status: 200 },
    { path: "/privacy", status: 200 },
    { path: "/signin", status: 200 },
    { path: "/api/health", status: 200 },
  ];

  const failures: string[] = [];
  for (const r of routes) {
    const res = await fetch(`${base}${r.path}`, { redirect: "manual" });
    const location = res.headers.get("location")?.replace(base, "") ?? "";
    const ok = "status" in r ? res.status === 200 : res.status >= 300 && res.status < 400 && r.redirectTo.test(location);
    console.log(`${ok ? "ok  " : "FAIL"} ${res.status} ${r.path}${location ? ` -> ${location}` : ""}`);
    if (!ok) failures.push(r.path);
  }
  await sql.end();
  console.log(`routes: ${routes.length - failures.length}/${routes.length} ok${failures.length ? `, failing: ${failures.join(", ")}` : ""}`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
