import "server-only";
import { sqlClient } from "@/db";
import { LEAD_STATUSES, type LeadStatus } from "@/db/schema/leads";

// Pro inbox and lead detail (docs/01 P3, P5, P6). Every read is scoped: a pro only sees leads
// assigned to them; a consumer only sees their own leads (docs/02 section 8.6).

const sql = sqlClient;

export type ProContext = { proId: string; proType: string; displayName: string; capPerDay: number; status: string };

export async function proForUser(userId: string): Promise<ProContext | null> {
  const [p] = await sql<ProContext[]>`
    select id as "proId", pro_type as "proType", display_name as "displayName", lead_cap_per_day as "capPerDay", status
    from pros where user_id = ${userId}`;
  return p ?? null;
}

export type InboxLead = {
  id: string;
  leadType: string;
  status: LeadStatus;
  score: number;
  consumerName: string;
  createdAt: string;
  assignedAt: string | null;
  firstResponseAt: string | null;
  listingId: string | null;
  listingPrice: number | null;
  listingType: string | null;
  address: string | null;
  coverKey: string | null;
};

export async function inbox(proId: string, filter: { status?: string; type?: string } = {}): Promise<InboxLead[]> {
  return sql<InboxLead[]>`
    select ld.id, ld.lead_type as "leadType", ld.status, ld.score, ld.consumer_name as "consumerName",
      ld.created_at::text as "createdAt", ld.assigned_at::text as "assignedAt", ld.first_response_at::text as "firstResponseAt",
      ld.listing_id as "listingId", l.price as "listingPrice", l.listing_type as "listingType",
      concat_ws(', ', concat_ws(' ', p.address_line2, p.address_line1), p.city) as address,
      (select storage_key from listing_media m where m.listing_id = ld.listing_id and m.storage_key is not null order by position limit 1) as "coverKey"
    from leads ld
    left join listings l on l.id = ld.listing_id
    left join properties p on p.id = coalesce(ld.property_id, l.property_id)
    where ld.assigned_pro_id = ${proId}
      and (${filter.status ?? null}::text is null or ld.status = ${filter.status ?? null})
      and (${filter.type ?? null}::text is null or ld.lead_type = ${filter.type ?? null})
    order by ld.assigned_at desc nulls last
    limit 200`;
}

export async function inboxStats(proId: string, capPerDay: number) {
  const [s] = await sql<{ newToday: number; thisMonth: number; medianResponse: number | null; today: number }[]>`
    select
      count(*) filter (where status = 'new' and assigned_at >= date_trunc('day', now() at time zone 'America/Toronto') at time zone 'America/Toronto')::int as "newToday",
      count(*) filter (where assigned_at >= date_trunc('month', now()))::int as "thisMonth",
      round(percentile_cont(0.5) within group (order by extract(epoch from first_response_at - assigned_at) / 60)
        filter (where first_response_at is not null and assigned_at >= now() - interval '30 days'))::int as "medianResponse",
      count(*) filter (where assigned_at >= date_trunc('day', now() at time zone 'America/Toronto') at time zone 'America/Toronto')::int as today
    from leads where assigned_pro_id = ${proId}`;
  return { ...s, capRemaining: Math.max(0, capPerDay - s.today) };
}

export type LeadDetail = InboxLead & {
  consumerEmail: string;
  consumerPhone: string | null;
  consumerUserId: string | null;
  message: string | null;
  payload: Record<string, unknown>;
  routingLog: { at: string; action: string; reason?: string; note?: string; status?: string }[];
  assignedProId: string | null;
  statusChangedAt: string;
};

/** Lead detail for its assigned pro only. */
export async function leadForPro(proId: string, leadId: string): Promise<LeadDetail | null> {
  const [row] = await sql<LeadDetail[]>`
    select ld.id, ld.lead_type as "leadType", ld.status, ld.score, ld.consumer_name as "consumerName",
      ld.consumer_email as "consumerEmail", ld.consumer_phone as "consumerPhone", ld.consumer_user_id as "consumerUserId",
      ld.message, ld.payload, ld.routing_log as "routingLog", ld.assigned_pro_id as "assignedProId",
      ld.created_at::text as "createdAt", ld.assigned_at::text as "assignedAt", ld.first_response_at::text as "firstResponseAt",
      ld.status_changed_at::text as "statusChangedAt",
      ld.listing_id as "listingId", l.price as "listingPrice", l.listing_type as "listingType",
      concat_ws(', ', concat_ws(' ', p.address_line2, p.address_line1), p.city) as address,
      null::text as "coverKey"
    from leads ld
    left join listings l on l.id = ld.listing_id
    left join properties p on p.id = coalesce(ld.property_id, l.property_id)
    where ld.id = ${leadId} and ld.assigned_pro_id = ${proId}`;
  return row ?? null;
}

/** docs/01 P5: what the consumer has been looking at, shown to their assigned pro. */
export async function consumerActivity(consumerUserId: string | null) {
  if (!consumerUserId) return { viewed: [], saved: [], searches: [] };
  const [viewed, saved, searches] = await Promise.all([
    sql<{ id: string; address: string; price: number; at: string }[]>`
      select l.id, concat_ws(', ', concat_ws(' ', p.address_line2, p.address_line1), p.city) as address, l.price, rv.viewed_at::text as at
      from recently_viewed rv join listings l on l.id = rv.listing_id join properties p on p.id = l.property_id
      where rv.user_id = ${consumerUserId} order by rv.viewed_at desc limit 10`,
    sql<{ id: string; address: string; price: number; at: string }[]>`
      select l.id, concat_ws(', ', concat_ws(' ', p.address_line2, p.address_line1), p.city) as address, l.price, sh.created_at::text as at
      from saved_homes sh join listings l on l.id = sh.listing_id join properties p on p.id = l.property_id
      where sh.user_id = ${consumerUserId} order by sh.created_at desc limit 10`,
    sql<{ name: string; at: string }[]>`select name, created_at::text as at from saved_searches where user_id = ${consumerUserId} order by created_at desc limit 5`,
  ]);
  return { viewed, saved, searches };
}

export type Message = { id: string; body: string; senderUserId: string; senderName: string | null; mine: boolean; createdAt: string };

export async function messages(leadId: string, viewerUserId: string): Promise<Message[]> {
  return sql<Message[]>`
    select m.id, m.body, m.sender_user_id as "senderUserId", coalesce(pr.display_name, u.name, 'Buyer') as "senderName",
      m.sender_user_id = ${viewerUserId} as mine, m.created_at::text as "createdAt"
    from lead_messages m join users u on u.id = m.sender_user_id left join pros pr on pr.user_id = m.sender_user_id
    where m.lead_id = ${leadId} order by m.created_at`;
}

/** Participant check for messaging: the consumer who owns the lead or the assigned pro. */
export async function leadParticipant(leadId: string, userId: string): Promise<"consumer" | "pro" | null> {
  const [row] = await sql<{ consumer: string | null; proUser: string | null }[]>`
    select ld.consumer_user_id as consumer, pr.user_id as "proUser"
    from leads ld left join pros pr on pr.id = ld.assigned_pro_id where ld.id = ${leadId}`;
  if (!row) return null;
  if (row.proUser === userId) return "pro";
  if (row.consumer === userId) return "consumer";
  return null;
}

/** First pro action on a lead counts as their first response (docs/03 step 9). */
async function markFirstResponse(leadId: string) {
  await sql`update leads set first_response_at = now() where id = ${leadId} and first_response_at is null`;
}

export async function addMessage(leadId: string, userId: string, role: "consumer" | "pro", body: string) {
  const [m] = await sql<{ id: string }[]>`insert into lead_messages (lead_id, sender_user_id, body) values (${leadId}, ${userId}, ${body}) returning id`;
  if (role === "pro") await markFirstResponse(leadId);
  return m;
}

export async function updateLeadByPro(proId: string, leadId: string, patch: { status?: LeadStatus; note?: string }) {
  if (patch.status && !LEAD_STATUSES.includes(patch.status)) return false;
  const entry = {
    at: new Date().toISOString(),
    action: patch.status ? "status_changed" : "note",
    status: patch.status,
    note: patch.note,
    pro_id: proId,
  };
  const rows = await sql`
    update leads set
      status = coalesce(${patch.status ?? null}, status),
      status_changed_at = case when ${patch.status ?? null}::text is not null and ${patch.status ?? null} <> status then now() else status_changed_at end,
      routing_log = routing_log || ${sql.json([entry] as never)},
      first_response_at = coalesce(first_response_at, now()),
      updated_at = now()
    where id = ${leadId} and assigned_pro_id = ${proId}
    returning id`;
  return rows.length > 0;
}

/** Consumer view of their own leads with the assigned pro's public details. */
export async function consumerLeads(userId: string) {
  return sql<{ id: string; leadType: string; status: string; createdAt: string; address: string | null; listingId: string | null; proName: string | null; proSlug: string | null; proPhoto: string | null; brokerage: string | null; proId: string | null; reviewed: boolean }[]>`
    select ld.id, ld.lead_type as "leadType", ld.status, ld.created_at::text as "createdAt",
      concat_ws(', ', concat_ws(' ', p.address_line2, p.address_line1), p.city) as address, ld.listing_id as "listingId",
      pr.display_name as "proName", pr.slug as "proSlug", pr.photo_url as "proPhoto", pr.brokerage_name as brokerage, pr.id as "proId",
      exists (select 1 from pro_reviews rv where rv.lead_id = ld.id) as reviewed
    from leads ld
    left join listings l on l.id = ld.listing_id
    left join properties p on p.id = coalesce(ld.property_id, l.property_id)
    left join pros pr on pr.id = ld.assigned_pro_id
    where ld.consumer_user_id = ${userId}
    order by ld.created_at desc`;
}
