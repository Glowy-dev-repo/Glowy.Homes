import "dotenv/config";
import postgres from "postgres";

// docs/05 Phase 2 criterion 5: similar homes returns 6 results of the same type within 3 km and
// 20% of price for at least 95% of active listings. Set based, so it checks every active listing.
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

const [{ total, hits }] = await sql<{ total: number; hits: number }[]>`
  select count(*)::int as total, count(*) filter (where n >= 6)::int as hits
  from listings s
  cross join lateral (
    select count(*) as n from (
      select 1 from listings l
      where l.listing_type = s.listing_type and l.property_type = s.property_type and l.status = 'active'
        and l.id <> s.id and l.price between floor(s.price * 0.8) and ceil(s.price * 1.2)
        and ST_DWithin(l.location, s.location, 3000)
      limit 6
    ) x
  ) m
  where s.status = 'active'`;
await sql.end();

const rate = hits / total;
console.log(`similar homes: ${hits} of ${total} active listings have 6 strict matches (${(rate * 100).toFixed(1)}%)`);
process.exit(rate >= 0.95 ? 0 : 1);
