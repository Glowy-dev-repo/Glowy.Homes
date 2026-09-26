import "server-only";
import { sqlClient } from "@/db";
import { coverJoin, summaryColumns } from "@/lib/search/postgres";
import type { SearchParams, ListingSummary } from "@/types/search";

// Saved homes, saved searches and recently viewed. Every function takes the owner's user id
// from the session, so rows are always scoped to their owner (docs/02 section 8.2).

const sql = sqlClient;

export async function savedHomeIds(userId: string): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`select listing_id as id from saved_homes where user_id = ${userId}`;
  return rows.map((r) => r.id);
}

export async function savedHomes(userId: string): Promise<(ListingSummary & { savedAt: string; note: string | null })[]> {
  return sql`
    select ${summaryColumns(sql)}, sh.created_at::text as "savedAt", sh.note
    from saved_homes sh
    join listings l on l.id = sh.listing_id
    join properties p on p.id = l.property_id
    ${coverJoin(sql)}
    where sh.user_id = ${userId}
    order by sh.created_at desc`;
}

/** Saves a home; save_count moves only when a row was actually inserted. */
export async function saveHome(userId: string, listingId: string): Promise<boolean> {
  return sql.begin(async (tx) => {
    const inserted = await tx`
      insert into saved_homes (user_id, listing_id)
      select ${userId}, id from listings where id = ${listingId}
      on conflict do nothing
      returning listing_id`;
    if (inserted.length) await tx`update listings set save_count = save_count + 1 where id = ${listingId}`;
    return inserted.length > 0;
  });
}

export async function unsaveHome(userId: string, listingId: string): Promise<boolean> {
  return sql.begin(async (tx) => {
    const deleted = await tx`delete from saved_homes where user_id = ${userId} and listing_id = ${listingId} returning listing_id`;
    if (deleted.length) await tx`update listings set save_count = greatest(save_count - 1, 0) where id = ${listingId}`;
    return deleted.length > 0;
  });
}

export type SavedSearchRow = {
  id: string;
  name: string;
  filters: SearchParams;
  alertFrequency: "instant" | "daily" | "weekly" | "off";
  lastAlertAt: string | null;
  createdAt: string;
};

export const MAX_SAVED_SEARCHES = 50;

export async function savedSearches(userId: string): Promise<SavedSearchRow[]> {
  return sql<SavedSearchRow[]>`
    select id, name, filters, alert_frequency as "alertFrequency", last_alert_at::text as "lastAlertAt", created_at::text as "createdAt"
    from saved_searches where user_id = ${userId} order by created_at desc`;
}

export async function createSavedSearch(
  userId: string,
  input: { name: string; filters: SearchParams; alertFrequency: SavedSearchRow["alertFrequency"] },
): Promise<SavedSearchRow | "limit"> {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from saved_searches where user_id = ${userId}`;
  if (n >= MAX_SAVED_SEARCHES) return "limit";
  const { page: _page, ...filters } = input.filters;
  const boundary = filters.polygon
    ? `SRID=4326;POLYGON((${[...filters.polygon, filters.polygon[0]].map(([x, y]) => `${x} ${y}`).join(", ")}))`
    : null;
  const [row] = await sql<SavedSearchRow[]>`
    insert into saved_searches (user_id, name, filters, boundary, alert_frequency, last_seen_listing_at)
    values (${userId}, ${input.name}, ${sql.json(filters as never)}, ${boundary ? sql`ST_GeogFromText(${boundary})` : null},
      ${input.alertFrequency}, now())
    returning id, name, filters, alert_frequency as "alertFrequency", last_alert_at::text as "lastAlertAt", created_at::text as "createdAt"`;
  return row;
}

export async function updateSavedSearch(
  userId: string,
  id: string,
  patch: { name?: string; alertFrequency?: SavedSearchRow["alertFrequency"] },
): Promise<SavedSearchRow | null> {
  const [row] = await sql<SavedSearchRow[]>`
    update saved_searches set
      name = coalesce(${patch.name ?? null}, name),
      alert_frequency = coalesce(${patch.alertFrequency ?? null}, alert_frequency)
    where id = ${id} and user_id = ${userId}
    returning id, name, filters, alert_frequency as "alertFrequency", last_alert_at::text as "lastAlertAt", created_at::text as "createdAt"`;
  return row ?? null;
}

export async function deleteSavedSearch(userId: string, id: string): Promise<boolean> {
  const rows = await sql`delete from saved_searches where id = ${id} and user_id = ${userId} returning id`;
  return rows.length > 0;
}

export async function recordRecentlyViewed(userId: string, items: { listingId: string; viewedAt: string }[]) {
  if (!items.length) return;
  await sql.unsafe(
    `insert into recently_viewed (user_id, listing_id, viewed_at)
     select $1::uuid, x.listing_id, x.viewed_at
     from jsonb_to_recordset($2::jsonb) as x(listing_id uuid, viewed_at timestamptz)
     join listings l on l.id = x.listing_id
     on conflict (user_id, listing_id) do update set viewed_at = greatest(recently_viewed.viewed_at, excluded.viewed_at)`,
    [userId, sql.json(items.map((i) => ({ listing_id: i.listingId, viewed_at: i.viewedAt })))],
  );
}

export async function recentlyViewed(userId: string, limit = 12): Promise<(ListingSummary & { viewedAt: number })[]> {
  return sql`
    select ${summaryColumns(sql)}, (extract(epoch from rv.viewed_at) * 1000)::float8 as "viewedAt"
    from recently_viewed rv
    join listings l on l.id = rv.listing_id
    join properties p on p.id = l.property_id
    ${coverJoin(sql)}
    where rv.user_id = ${userId}
    order by rv.viewed_at desc
    limit ${limit}`;
}
