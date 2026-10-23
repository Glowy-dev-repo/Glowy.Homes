import "server-only";
import { sqlClient } from "@/db";
import { brokerConfigured } from "@/config/broker";
import { leadAssignmentMode } from "@/lib/leads/assignment";
import { previewPassword } from "@/lib/preview";

// Data for the admin home and leads screens, in the words an owner uses: what needs attention now.

const sql = sqlClient;

export type AdminCounts = {
  waiting: number;
  approvals: number;
  pendingAgents: number;
  activeAgents: number;
  leadsWeek: number;
  leadsMonth: number;
  forSale: number;
  forRent: number;
};

export async function adminCounts(): Promise<AdminCounts> {
  const [c] = await sql<AdminCounts[]>`
    select
      (select count(*)::int from leads where assigned_pro_id is null and status in ('new', 'unassigned')) as waiting,
      (select count(*)::int from moderation_items where status = 'open') as approvals,
      (select count(*)::int from pros where pro_type = 'agent' and status = 'pending') as "pendingAgents",
      (select count(*)::int from pros where pro_type = 'agent' and status = 'active') as "activeAgents",
      (select count(*)::int from leads where created_at >= now() - interval '7 days') as "leadsWeek",
      (select count(*)::int from leads where created_at >= now() - interval '30 days') as "leadsMonth",
      (select count(*)::int from listings where status = 'active' and listing_type = 'sale') as "forSale",
      (select count(*)::int from listings where status = 'active' and listing_type = 'rent') as "forRent"`;
  return c;
}

export type AdminLeadCard = {
  id: string;
  leadType: string;
  status: string;
  consumerName: string;
  consumerEmail: string;
  consumerPhone: string | null;
  message: string | null;
  createdAt: string;
  address: string | null;
  zip: string | null;
  area: string | null;
  source: "idx" | "site";
  proId: string | null;
  proName: string | null;
  suggestedProId: string | null;
  suggestedName: string | null;
  note: string | null;
};

/** How many leads have an agent (for paging the Assigned view). */
export async function assignedLeadCount(): Promise<number> {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from leads where assigned_pro_id is not null`;
  return r.n;
}

/**
 * Leads still waiting for Glowy Homes to choose the agent, oldest first (or "assigned": the latest with
 * an agent), one page at a time. With `leadId`, just that lead, whatever its state (links in admin emails).
 */
export async function adminLeadCards(view: "waiting" | "assigned", opts: { limit?: number; offset?: number; leadId?: string } = {}): Promise<AdminLeadCard[]> {
  const limit = opts.limit ?? 40;
  const offset = opts.offset ?? 0;
  const where = opts.leadId
    ? sql`ld.id = ${opts.leadId}`
    : view === "waiting"
      ? sql`ld.assigned_pro_id is null and ld.status in ('new', 'unassigned')`
      : sql`ld.assigned_pro_id is not null`;
  return sql<AdminLeadCard[]>`
    select ld.id, ld.lead_type as "leadType", ld.status, ld.consumer_name as "consumerName", ld.consumer_email as "consumerEmail",
      ld.consumer_phone as "consumerPhone", ld.message, ld.created_at::text as "createdAt",
      coalesce(case when p.id is not null then concat_ws(', ', concat_ws(' ', p.address_line2, p.address_line1), p.city) end,
        nullif(ld.payload->>'address', '')) as address,
      coalesce(nullif(left(p.postal_code, 5), ''), case when ld.payload->>'zip' ~ '^[0-9]{5}$' then ld.payload->>'zip' end) as zip,
      r.name as area,
      case when ld.external_ref like 'idx:%' then 'idx' else 'site' end as source,
      pr.id as "proId", pr.display_name as "proName",
      sp.id as "suggestedProId", sp.display_name as "suggestedName",
      case when sp.id is null then (ld.routing_log -> -1 ->> 'reason') end as note
    from leads ld
    left join listings l on l.id = ld.listing_id
    left join properties p on p.id = coalesce(ld.property_id, l.property_id)
    left join regions r on r.id = ld.region_id
    left join pros pr on pr.id = ld.assigned_pro_id
    left join lateral (
      select x.id, x.display_name from jsonb_array_elements(ld.routing_log) e
      join pros x on x.id::text = e->>'suggested_pro_id' and x.status = 'active'
      where e->>'action' = 'awaiting_admin' order by e->>'at' desc limit 1
    ) sp on true
    where ${where}
    order by ${view === "waiting" ? sql`ld.created_at asc, ld.id` : sql`coalesce(ld.assigned_at, ld.created_at) desc, ld.id`}
    limit ${limit} offset ${offset}`;
}

export type SetupItem = { label: string; done: boolean; detail: string };

/**
 * What the live site still needs, read from its settings. Only says whether something is set, never
 * the value.
 */
export function setupChecklist(): SetupItem[] {
  const has = (k: string) => !!process.env[k]?.trim() && !/replace_me|replace_with/i.test(process.env[k] ?? "");
  const feed = process.env.LISTING_FEED ?? "synthetic";
  return [
    { label: "Real MLS listings", done: feed !== "synthetic", detail: feed === "synthetic" ? "Showing demo listings until the MLS feed is approved and connected." : `Connected (${feed}).` },
    { label: "Brokerage shown on every page", done: brokerConfigured, detail: brokerConfigured ? "Keller Williams World Class details are set." : "Set the broker details so the MLS required brokerage bar shows." },
    { label: "Emails can be sent", done: has("RESEND_API_KEY"), detail: has("RESEND_API_KEY") ? "Sign in links, lead and alert emails are on." : "Add RESEND_API_KEY so sign in links and lead emails go out." },
    { label: "Background jobs", done: has("INNGEST_SIGNING_KEY") || process.env.NODE_ENV !== "production", detail: "Lead routing, admin emails, listing updates and alerts run as background jobs (Inngest)." },
    { label: "Spam protection on forms", done: has("TURNSTILE_SECRET_KEY"), detail: has("TURNSTILE_SECRET_KEY") ? "Cloudflare Turnstile is on." : "Add the Turnstile keys before the site goes public." },
    { label: "Photo storage", done: has("R2_BUCKET") && has("R2_ACCESS_KEY_ID"), detail: "Landlord and agent photos are kept safely in Cloudflare R2." },
    { label: "Site is public", done: !previewPassword(), detail: previewPassword() ? "Private: visitors need the preview password." : "Open to everyone." },
    { label: "Glowy Homes chooses each lead's agent", done: leadAssignmentMode() === "admin", detail: leadAssignmentMode() === "admin" ? "Every lead waits here for you to assign." : "Leads go straight to the agent for the ZIP code." },
  ];
}
