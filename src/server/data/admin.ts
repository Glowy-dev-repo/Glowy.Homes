import "server-only";
import { sqlClient } from "@/db";

const sql = sqlClient;

export type FeedRun = { id: string; source: string; status: string; startedAt: string; finishedAt: string | null; stats: Record<string, number>; errorSample: unknown[] | null };

/** docs/01 AD1 and docs/03 section 1.3 failure signals. */
export async function feedHealth() {
  const runs = await sql<FeedRun[]>`
    select id, source, status, started_at::text as "startedAt", finished_at::text as "finishedAt", stats, error_sample as "errorSample"
    from feed_runs order by started_at desc limit 20`;
  const [counts] = await sql<{ active: number; sale: number; rent: number; total: number }[]>`
    select count(*) filter (where status = 'active')::int as active,
      count(*) filter (where status = 'active' and listing_type = 'sale')::int as sale,
      count(*) filter (where status = 'active' and listing_type = 'rent')::int as rent,
      count(*)::int as total
    from listings`;
  const last = runs[0];
  const lastSuccess = runs.find((r) => r.status === "success" || r.status === "partial");
  const scheduled = process.env.LISTING_FEED === "reso" || process.env.LISTING_FEED === "crea_ddf";
  const signals: string[] = [];
  if (scheduled && (!lastSuccess || Date.now() - Date.parse(lastSuccess.startedAt) > 60 * 60_000)) signals.push("No successful feed run in the last 60 minutes.");
  if (last && (last.stats.errors ?? 0) >= Math.max(1, (last.stats.fetched ?? 0) * 0.02)) signals.push("The last run had errors on 2% or more of records.");
  if (last?.status === "failed") signals.push("The last feed run failed.");
  return { runs, counts, signals, lastSuccessAt: lastSuccess?.startedAt ?? null };
}

/** docs/01 AD3: lead volume and routing by area, last 30 days. */
export async function leadStats() {
  const [byCity, unassigned, [totals]] = await Promise.all([
    sql<{ city: string; total: number; unassigned: number; newCount: number; closed: number; medianResponse: number | null }[]>`
      select coalesce(c.name, 'Unknown') as city, count(*)::int as total,
        count(*) filter (where ld.status = 'unassigned' or ld.assigned_pro_id is null)::int as unassigned,
        count(*) filter (where ld.status = 'new')::int as "newCount",
        count(*) filter (where ld.status = 'closed')::int as closed,
        round(percentile_cont(0.5) within group (order by extract(epoch from ld.first_response_at - ld.assigned_at) / 60)
          filter (where ld.first_response_at is not null))::int as "medianResponse"
      from leads ld
      left join regions r on r.id = ld.region_id
      left join regions c on c.id = case when r.type = 'neighborhood' then r.parent_id else r.id end
      where ld.created_at >= now() - interval '30 days'
      group by 1 order by total desc`,
    sql<{ id: string; leadType: string; consumerName: string; createdAt: string; region: string | null; reason: string | null }[]>`
      select ld.id, ld.lead_type as "leadType", ld.consumer_name as "consumerName", ld.created_at::text as "createdAt", r.name as region,
        (ld.routing_log -> -1 ->> 'reason') as reason
      from leads ld left join regions r on r.id = ld.region_id
      where ld.assigned_pro_id is null and ld.status in ('new', 'unassigned')
      order by ld.created_at desc limit 50`,
    sql<{ today: number; month: number }[]>`
      select count(*) filter (where created_at >= now() - interval '1 day')::int as today, count(*) filter (where created_at >= now() - interval '30 days')::int as month
      from leads`,
  ]);
  return { byCity, unassigned, totals };
}

export async function recentLeads(limit = 30) {
  return sql<{ id: string; leadType: string; status: string; consumerName: string; createdAt: string; proName: string | null; proId: string | null; region: string | null }[]>`
    select ld.id, ld.lead_type as "leadType", ld.status, ld.consumer_name as "consumerName", ld.created_at::text as "createdAt",
      pr.display_name as "proName", pr.id as "proId", r.name as region
    from leads ld left join pros pr on pr.id = ld.assigned_pro_id left join regions r on r.id = ld.region_id
    order by ld.created_at desc limit ${limit}`;
}

export async function activeProsForRegion(leadId: string) {
  return sql<{ id: string; displayName: string; proType: string; covers: boolean }[]>`
    select p.id, p.display_name as "displayName", p.pro_type as "proType",
      exists (select 1 from pro_service_areas a join leads ld on ld.id = ${leadId}
        left join regions r on r.id = ld.region_id
        where a.pro_id = p.id and a.region_id in (ld.region_id, r.parent_id)) as covers
    from pros p where p.status = 'active' and p.pro_type in ('agent', 'lender')
    order by covers desc, p.display_name limit 200`;
}

export type ModerationRow = {
  id: string;
  itemType: "listing" | "review" | "pro";
  itemId: string;
  reason: string;
  createdAt: string;
  title: string;
  detail: string;
  priority: "high" | "low";
  failedChecks: string[];
};

/** docs/01 AD2 and AD5: open items, oldest first, high priority on top. */
export async function moderationQueue(): Promise<ModerationRow[]> {
  return sql<ModerationRow[]>`
    select m.id, m.item_type as "itemType", m.item_id as "itemId", m.reason, m.created_at::text as "createdAt",
      case m.item_type
        when 'pro' then (select p.display_name || ' (' || p.pro_type || ')' from pros p where p.id = m.item_id)
        when 'review' then (select rv.rating || ' star review for ' || p.display_name from pro_reviews rv join pros p on p.id = rv.pro_id where rv.id = m.item_id)
        when 'listing' then (select concat_ws(', ', concat_ws(' ', pp.address_line2, pp.address_line1), pp.city) || ' (' || l.listing_type || ')'
          from listings l join properties pp on pp.id = l.property_id where l.id = m.item_id)
      end as title,
      case m.item_type
        when 'pro' then (select 'Licence ' || coalesce(p.license_number, 'not given') || coalesce(', ' || p.brokerage_name, '') from pros p where p.id = m.item_id)
        when 'review' then (select coalesce(rv.body, '') from pro_reviews rv where rv.id = m.item_id)
        when 'listing' then (select left(coalesce(l.description, ''), 240) from listings l where l.id = m.item_id)
      end as detail,
      case when jsonb_array_length(m.failed_checks) > 0 then 'high' else 'low' end as priority,
      coalesce(array(select jsonb_array_elements_text(m.failed_checks)), '{}') as "failedChecks"
    from moderation_items m
    where m.status = 'open'
    order by (jsonb_array_length(m.failed_checks) > 0) desc, m.created_at`;
}

export async function recomputeProRating(proId: string) {
  await sql`
    update pros set
      rating = (select round(avg(rating)::numeric, 1) from pro_reviews where pro_id = ${proId} and status = 'approved'),
      review_count = (select count(*)::int from pro_reviews where pro_id = ${proId} and status = 'approved')
    where id = ${proId}`;
}

/** Applies an admin decision. Listing decisions are handled by the listing moderation module. */
export async function decideModeration(itemId: string, decision: "approve" | "reject", note: string | null, adminId: string) {
  const [item] = await sql<{ itemType: string; itemId: string }[]>`
    update moderation_items set status = ${decision === "approve" ? "approved" : "rejected"}, reviewer_user_id = ${adminId},
      decision_note = ${note}, resolved_at = now()
    where id = ${itemId} and status = 'open'
    returning item_type as "itemType", item_id as "itemId"`;
  if (!item) return null;
  if (item.itemType === "pro") {
    await sql`
      update pros set status = ${decision === "approve" ? "active" : "suspended"},
        license_verified_at = case when ${decision === "approve"} then now() else license_verified_at end, updated_at = now()
      where id = ${item.itemId}`;
  } else if (item.itemType === "review") {
    const [r] = await sql<{ proId: string }[]>`
      update pro_reviews set status = ${decision === "approve" ? "approved" : "rejected"} where id = ${item.itemId} returning pro_id as "proId"`;
    if (r) await recomputeProRating(r.proId);
  }
  return item;
}
