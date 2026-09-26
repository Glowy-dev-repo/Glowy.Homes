import "dotenv/config";
import postgres from "postgres";
import { syntheticBlurDataUrl } from "../src/lib/media/synthetic";

// `npx tsx scripts/refresh_synthetic_blur.ts`: recompute blur placeholders after a synthetic photo restyle.
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const rows = await sql<{ id: string; source_url: string }[]>`select id, source_url from listing_media where source_url like 'synthetic://%'`;
for (let i = 0; i < rows.length; i += 5000) {
  const batch = rows.slice(i, i + 5000).map((r) => ({ id: r.id, blur: syntheticBlurDataUrl(r.source_url) }));
  await sql`update listing_media m set blur_data_url = x.blur from jsonb_to_recordset(${sql.json(batch)}) as x(id uuid, blur text) where m.id = x.id`;
}
console.log(`blur placeholders refreshed: ${rows.length}`);
await sql.end();
