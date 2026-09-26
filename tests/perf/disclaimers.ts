import "dotenv/config";
import postgres from "postgres";

// docs/05 Phase 3 gate: "disclaimer presence check". Fetches server rendered HTML for a sample of
// listing and property value pages and fails if any page shows an estimate number without the
// range, the confidence label and the disclaimer.
const baseUrl = process.env.PERF_BASE_URL ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const listings = await sql<{ id: string; line1: string; line2: string | null; city: string }[]>`select l.id, p.address_line1 as line1, p.address_line2 as line2, p.city from listings l join properties p on p.id = l.property_id where l.status in ('active', 'sold', 'pending') order by random() limit 30`;
const properties = await sql<{ id: string; line1: string; line2: string | null; city: string }[]>`select id, address_line1 as line1, address_line2 as line2, city from properties order by random() limit 15`;
await sql.end();

const slug = (r: { line1: string; line2: string | null; city: string }) => [r.line1, r.line2, r.city].filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const urls = [...listings.map((l) => `${baseUrl}/listing/${l.id}/${slug(l)}`), ...properties.map((p) => `${baseUrl}/home-value/${p.id}/${slug(p)}`)];
const failures: string[] = [];
let withEstimate = 0;
for (const url of urls) {
  const html = await (await fetch(url)).text();
  const cards = html.split('data-testid="estimate-card"').slice(1);
  if (!cards.length) failures.push(`${url}: no estimate card`);
  for (const card of cards) {
    if (!card.includes('data-testid="estimate-disclaimer"') || !card.includes("This is an automated estimate, not an appraisal.")) failures.push(`${url}: missing disclaimer`);
    if (card.includes('data-testid="estimate-value"')) {
      withEstimate++;
      if (!card.includes('data-testid="estimate-range"')) failures.push(`${url}: missing range`);
      if (!card.includes('data-testid="estimate-confidence"')) failures.push(`${url}: missing confidence`);
    }
  }
}
console.log(`disclaimers: ${urls.length} pages checked, ${withEstimate} showing an estimate, ${failures.length} problems`);
for (const f of failures.slice(0, 10)) console.log(`  ${f}`);
process.exit(failures.length ? 1 : 0);
