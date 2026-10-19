import "dotenv/config";
import postgres from "postgres";

// Direct database access for assertions that must be "reflected in the database" (docs/05).
let client: postgres.Sql | null = null;

export function db(): postgres.Sql {
  client ??= postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
  return client;
}

/** Deletes listings a test created, everything that points at them, and their homes if nothing else uses them. */
export async function removeListings(listingIds: string[]): Promise<void> {
  if (!listingIds.length) return;
  await db().begin(async (tx) => {
    const props = (await tx<{ id: string }[]>`select distinct property_id as id from listings where id = any(${listingIds}::uuid[])`).map((r) => r.id);
    await tx`delete from listing_price_events where listing_id = any(${listingIds}::uuid[])`;
    await tx`delete from rental_application_submissions where listing_id = any(${listingIds}::uuid[])`;
    await tx`delete from leads where listing_id = any(${listingIds}::uuid[])`;
    await tx`delete from valuation_accuracy where listing_id = any(${listingIds}::uuid[])`;
    await tx`delete from listings where id = any(${listingIds}::uuid[])`;
    const orphans = (
      await tx<{ id: string }[]>`select p.id from properties p where p.id = any(${props}::uuid[]) and not exists (select 1 from listings l where l.property_id = p.id)`
    ).map((r) => r.id);
    if (!orphans.length) return;
    for (const table of ["listing_price_events", "valuation_accuracy", "valuations", "property_claims", "leads"]) {
      await tx.unsafe(`delete from ${table} where property_id = any($1::uuid[])`, [orphans]);
    }
    await tx`delete from properties where id = any(${orphans}::uuid[])`;
  });
}

/** Homes whose ZIP code has at least one partner agent, so a lead on them can be assigned. */
export const COVERED_ZIP = "exists (select 1 from pro_zip_codes z where z.zip = left(p.postal_code, 5))";

// Seller opt outs (hidden listing or withheld address) are left out so pages show the full address.
// Never a listing a feed test ingested (SimplyRETS): it must not become every other test's sample.
export async function sampleListingPath(where = "l.listing_type = 'sale' and l.status = 'active'"): Promise<{ id: string; path: string; price: number }> {
  const [row] = await db().unsafe<{ id: string; line1: string; line2: string | null; city: string; price: number }[]>(
    `select l.id, p.address_line1 as line1, p.address_line2 as line2, p.city, l.price
     from listings l join properties p on p.id = l.property_id
     where (${where}) and l.source <> 'simplyrets' and l.internet_display and l.address_display
     order by l.list_date desc, l.id limit 1`,
  );
  const slug = [row.line1, row.line2, row.city].filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { id: row.id, path: `/listing/${row.id}/${slug}`, price: row.price };
}
