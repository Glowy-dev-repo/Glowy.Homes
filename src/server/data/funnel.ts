import "server-only";
import { sqlClient } from "@/db";

// Admin funnel (docs/05 Phase 6 task 5): of the visitors who searched a city, how many opened a
// listing there, and how many of those sent a lead about a home there. Visitors are the anonymous
// id cookie, or the account when there is none.

export type FunnelRow = { city: string; name: string; searchers: number; viewers: number; leads: number };

export async function cityFunnel(days = 30): Promise<FunnelRow[]> {
  return sqlClient<FunnelRow[]>`
    with e as (
      select coalesce(anon_id, user_id::text) as actor, name, props->>'city' as city, created_at
      from events
      where created_at > now() - make_interval(days => ${days}) and name in ('search', 'listing_view', 'lead_submit')
        and props->>'city' is not null and coalesce(anon_id, user_id::text) is not null
    ),
    s as (select actor, city, min(created_at) as at from e where name = 'search' group by 1, 2),
    v as (select e.actor, e.city, min(e.created_at) as at from e join s using (actor, city) where e.name = 'listing_view' and e.created_at >= s.at group by 1, 2),
    l as (select e.actor, e.city from e join v using (actor, city) where e.name = 'lead_submit' and e.created_at >= v.at group by 1, 2)
    select s.city, coalesce(r.name, s.city) as name, count(*)::int as searchers,
      count(v.actor)::int as viewers, count(l.actor)::int as leads
    from s
    left join v on v.actor = s.actor and v.city = s.city
    left join l on l.actor = s.actor and l.city = s.city
    left join regions r on r.slug = s.city and r.type = 'city'
    group by s.city, r.name
    order by searchers desc`;
}

export async function eventCounts(days = 7): Promise<{ name: string; count: number }[]> {
  return sqlClient<{ name: string; count: number }[]>`
    select name, count(*)::int as count from events where created_at > now() - make_interval(days => ${days})
    group by name order by count desc`;
}
