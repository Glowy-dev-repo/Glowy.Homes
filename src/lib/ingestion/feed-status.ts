import { sqlClient } from "@/db";

/** When listings were last refreshed from the feed: shown next to MLS listings (CSMAR Rule 12.16.7). */
export async function lastFeedUpdate(): Promise<string | null> {
  const [row] = await sqlClient<{ at: string | null }[]>`
    select max(finished_at)::text as at from feed_runs where status = 'success'`;
  return row?.at ?? null;
}
