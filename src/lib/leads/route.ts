import type postgres from "postgres";
import { brand } from "@/config/brand";
import type { LeadType, RoutingLogEntry } from "@/db/schema/leads";
import { sendEmail } from "@/lib/email";
import { adminUnassignedEmail, consumerConfirmationEmail, proNewLeadEmail } from "@/lib/email/templates/leads";
import { decideRoute, scoreLead, type Candidate } from "./routing";

// route_lead database orchestration (docs/03 section 5).

type Sql = postgres.Sql;

export const ROUTE_TO_LISTING_AGENT = process.env.ROUTE_TO_LISTING_AGENT === "true";

type LeadRow = {
  id: string;
  leadType: LeadType;
  status: string;
  consumerUserId: string | null;
  consumerName: string;
  consumerEmail: string;
  consumerPhone: string | null;
  message: string | null;
  payload: Record<string, unknown>;
  assignedProId: string | null;
  routingLog: RoutingLogEntry[];
  regionId: string | null;
  hoodId: string | null;
  cityId: string | null;
  regionName: string | null;
  listingAgentId: string | null;
  listingOwnerProId: string | null;
  listingPrice: number | null;
  listingType: string | null;
  address: string | null;
};

async function loadLead(sql: Sql, leadId: string): Promise<LeadRow | null> {
  const [row] = await sql<LeadRow[]>`
    select ld.id, ld.lead_type as "leadType", ld.status, ld.consumer_user_id as "consumerUserId",
      ld.consumer_name as "consumerName", ld.consumer_email as "consumerEmail", ld.consumer_phone as "consumerPhone",
      ld.message, ld.payload, ld.assigned_pro_id as "assignedProId", ld.routing_log as "routingLog",
      ld.region_id as "regionId",
      case when r.type = 'neighborhood' then r.id end as "hoodId",
      case when r.type = 'neighborhood' then r.parent_id else r.id end as "cityId",
      r.name as "regionName",
      l.listing_agent_id as "listingAgentId",
      (select pr.id from pros pr where pr.user_id = l.owner_user_id and pr.status = 'active') as "listingOwnerProId",
      l.price as "listingPrice", l.listing_type as "listingType",
      coalesce(concat_ws(', ', concat_ws(' ', p.address_line2, p.address_line1), p.city), null) as address
    from leads ld
    left join regions r on r.id = ld.region_id
    left join listings l on l.id = ld.listing_id
    left join properties p on p.id = coalesce(ld.property_id, l.property_id)
    where ld.id = ${leadId}`;
  return row ?? null;
}

async function scoreFor(sql: Sql, lead: LeadRow): Promise<number> {
  const [s] = await sql<{ saved: number; viewed: number; top: boolean }[]>`
    select
      (select count(*)::int from saved_homes where user_id = ${lead.consumerUserId}) as saved,
      (select count(*)::int from recently_viewed where user_id = ${lead.consumerUserId} and viewed_at >= now() - interval '7 days') as viewed,
      coalesce(${lead.listingPrice}::int >= (
        select percentile_cont(0.7) within group (order by price) from listings
        where city_region_id = ${lead.cityId} and listing_type = coalesce(${lead.listingType}, 'sale') and status = 'active'
      ), false) as top`;
  return scoreLead({
    leadType: lead.leadType,
    loggedIn: !!lead.consumerUserId,
    hasPhone: !!lead.consumerPhone,
    savedHomes: lead.consumerUserId ? s.saved : 0,
    listingsViewed7d: lead.consumerUserId ? s.viewed : 0,
    listingInTop30PctOfCity: !!lead.listingPrice && s.top,
  });
}

async function loadCandidates(sql: Sql, lead: LeadRow, extraIds: string[]): Promise<Candidate[]> {
  return sql<Candidate[]>`
    select pr.id as "proId", pr.pro_type as "proType", pr.status, pr.is_accepting_leads as "isAccepting",
      pr.lead_cap_per_day as "capPerDay", pr.response_time_minutes as "responseTimeMinutes", pr.rating::float8 as rating,
      (select count(*)::int from leads x where x.assigned_pro_id = pr.id
        and x.assigned_at >= (date_trunc('day', now() at time zone 'America/Toronto') at time zone 'America/Toronto')) as "assignedToday",
      case
        when exists (select 1 from pro_service_areas a where a.pro_id = pr.id and a.region_id = ${lead.hoodId} and (a.active_until is null or a.active_until > now())) then 'neighborhood'
        when exists (select 1 from pro_service_areas a where a.pro_id = pr.id and a.region_id = ${lead.cityId} and (a.active_until is null or a.active_until > now())) then 'city'
        else null
      end as "areaMatch"
    from pros pr
    where pr.id in (select pro_id from pro_service_areas where region_id in (${lead.hoodId}, ${lead.cityId}))
       or pr.id = any(${extraIds}::uuid[])`;
}

export type RouteOutcome = { status: "assigned"; proId: string } | { status: "unassigned"; reason: string } | { status: "skipped"; reason: string };

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? `https://${brand.domain}`;

/**
 * Assigns a lead to exactly one pro, or marks it unassigned. `mode` records why routing ran.
 * Reassignment excludes everyone who already had the lead.
 */
export async function routeLead(sql: Sql, leadId: string, mode: "initial" | "retry" | "reassign" = "initial"): Promise<RouteOutcome> {
  const lead = await loadLead(sql, leadId);
  if (!lead) return { status: "skipped", reason: "lead not found" };
  if (mode !== "reassign" && lead.assignedProId) return { status: "skipped", reason: "already assigned" };
  if (["closed", "lost", "under_contract"].includes(lead.status)) return { status: "skipped", reason: `lead is ${lead.status}` };

  const previous = [...new Set(lead.routingLog.map((e) => e.pro_id).filter((x): x is string => !!x))];
  const requestedProId = typeof lead.payload.requested_pro_id === "string" ? lead.payload.requested_pro_id : null;
  const extra = [requestedProId, lead.listingAgentId, lead.listingOwnerProId].filter((x): x is string => !!x);
  const score = mode === "initial" ? await scoreFor(sql, lead) : null;

  let exclude = [...previous];
  for (let attempt = 0; attempt < 3; attempt++) {
    const candidates = await loadCandidates(sql, lead, extra);
    const decision = decideRoute({
      leadType: lead.leadType,
      requestedProId,
      listingAgentId: lead.listingAgentId,
      listingOwnerProId: lead.listingOwnerProId,
      routeToListingAgent: ROUTE_TO_LISTING_AGENT,
      exclude,
      candidates,
    });

    if (!decision.assign) {
      const entry: RoutingLogEntry = { at: new Date().toISOString(), action: mode === "reassign" ? "reassign_failed" : "unassigned", reason: decision.reason, candidates: decision.considered };
      await sql`
        update leads set status = case when assigned_pro_id is null or ${mode === "reassign"} then 'unassigned' else status end,
          assigned_pro_id = case when ${mode === "reassign"} then null else assigned_pro_id end,
          score = coalesce(${score}, score), routing_log = routing_log || ${sql.json([entry] as never)}, updated_at = now()
        where id = ${leadId}`;
      await notifyUnassigned(sql, lead, decision.reason);
      return { status: "unassigned", reason: decision.reason };
    }

    // Lock the pro and recheck the cap so concurrent leads cannot push them over it.
    const assigned = await sql.begin(async (tx) => {
      const [p] = await tx<{ cap: number; today: number }[]>`
        select lead_cap_per_day as cap,
          (select count(*)::int from leads x where x.assigned_pro_id = pros.id
            and x.assigned_at >= (date_trunc('day', now() at time zone 'America/Toronto') at time zone 'America/Toronto')) as today
        from pros where id = ${decision.assign} for update`;
      if (!p || p.today >= p.cap) return false;
      const entry: RoutingLogEntry = {
        at: new Date().toISOString(),
        action: mode === "reassign" ? "reassigned" : "assigned",
        pro_id: decision.assign,
        reason: decision.reason,
        candidates: decision.considered,
      };
      await tx`
        update leads set assigned_pro_id = ${decision.assign}, assigned_at = now(), status = 'new', status_changed_at = now(),
          first_response_at = null, score = coalesce(${score}, score), routing_log = routing_log || ${tx.json([entry] as never)}, updated_at = now()
        where id = ${leadId}`;
      return true;
    });
    if (assigned) {
      await notifyAssigned(sql, lead, decision.assign);
      return { status: "assigned", proId: decision.assign };
    }
    exclude = [...exclude, decision.assign];
  }
  return { status: "unassigned", reason: "cap reached while assigning" };
}

/**
 * docs/03 step 9: if the pro has not responded in time, reassign to the next candidate and make
 * their response score worse.
 */
export async function checkFirstResponse(sql: Sql, leadId: string, proId: string): Promise<RouteOutcome | { status: "responded" }> {
  const [lead] = await sql<{ assigned: string | null; responded: boolean; status: string }[]>`
    select assigned_pro_id as assigned, first_response_at is not null as responded, status from leads where id = ${leadId}`;
  if (!lead || lead.assigned !== proId || lead.responded || lead.status !== "new") return { status: "responded" };
  await sql`update pros set response_time_minutes = coalesce(response_time_minutes, 30) + 10 where id = ${proId}`;
  await sql`
    update leads set routing_log = routing_log || ${sql.json([{ at: new Date().toISOString(), action: "no_response", pro_id: proId, reason: "no first response in time" }] as never)}
    where id = ${leadId}`;
  return routeLead(sql, leadId, "reassign");
}

/** Admin override (docs/01 AD4), recorded in routing_log. */
export async function adminReassign(sql: Sql, leadId: string, proId: string, adminUserId: string) {
  const entry = { at: new Date().toISOString(), action: "admin_reassigned", pro_id: proId, reason: "manual reassignment by admin", admin_user_id: adminUserId };
  const rows = await sql`
    update leads set assigned_pro_id = ${proId}, assigned_at = now(), status = 'new', status_changed_at = now(), first_response_at = null,
      routing_log = routing_log || ${sql.json([entry] as never)}, updated_at = now()
    where id = ${leadId} and exists (select 1 from pros where id = ${proId} and status = 'active')
    returning id`;
  if (!rows.length) return false;
  const lead = await loadLead(sql, leadId);
  if (lead) await notifyAssigned(sql, lead, proId);
  return true;
}

async function notifyAssigned(sql: Sql, lead: LeadRow, proId: string) {
  const [pro] = await sql<{ name: string; brokerage: string | null; email: string }[]>`
    select p.display_name as name, p.brokerage_name as brokerage, u.email from pros p join users u on u.id = p.user_id where p.id = ${proId}`;
  if (!pro) return;
  await sendEmail({
    to: pro.email,
    ...proNewLeadEmail({ appUrl: appUrl(), leadId: lead.id, leadType: lead.leadType, consumerName: lead.consumerName, consumerEmail: lead.consumerEmail, consumerPhone: lead.consumerPhone, address: lead.address, message: lead.message }),
  }).catch((e) => console.warn(`[leads] pro email failed: ${e}`));
  await sendEmail({
    to: lead.consumerEmail,
    ...consumerConfirmationEmail({ appUrl: appUrl(), consumerName: lead.consumerName, leadType: lead.leadType, proName: pro.name, brokerage: pro.brokerage, address: lead.address }),
  }).catch((e) => console.warn(`[leads] consumer email failed: ${e}`));
}

async function notifyUnassigned(sql: Sql, lead: LeadRow, reason: string) {
  const admins = await sql<{ email: string }[]>`select email from users where 'admin' = any(roles)`;
  for (const a of admins) {
    await sendEmail({ to: a.email, ...adminUnassignedEmail({ appUrl: appUrl(), leadId: lead.id, leadType: lead.leadType, reason, region: lead.regionName }) }).catch(() => {});
  }
  // Only once per lead: the consumer hears that matching is in progress.
  if (!lead.routingLog.some((e) => e.action === "unassigned")) {
    await sendEmail({
      to: lead.consumerEmail,
      ...consumerConfirmationEmail({ appUrl: appUrl(), consumerName: lead.consumerName, leadType: lead.leadType, proName: null, brokerage: null, address: lead.address }),
    }).catch(() => {});
  }
}

/** Rolling 30 day median minutes from assignment to first response, per pro (nightly). */
export async function refreshProResponseTimes(sql: Sql) {
  await sql`
    update pros p set response_time_minutes = s.median
    from (
      select assigned_pro_id as id, round(percentile_cont(0.5) within group (order by extract(epoch from first_response_at - assigned_at) / 60))::int as median
      from leads where first_response_at is not null and assigned_at >= now() - interval '30 days' group by 1
    ) s where p.id = s.id`;
}
