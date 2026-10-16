import "server-only";
import { z } from "zod";
import { sqlClient } from "@/db";
import { LEAD_STATUSES } from "@/db/schema/leads";

// Admin directory views: every partner agent, every lead with filters, and ZIP code coverage.

const sql = sqlClient;
export const ADMIN_PAGE_SIZE = 40;

/** The ZIP code a lead is about: the home in our database, or the one stored by the IDX lead import. */
const leadZips = sql`
  select ld.id as lead_id,
    coalesce(nullif(left(p.postal_code, 5), ''), case when ld.payload->>'zip' ~ '^[0-9]{5}$' then ld.payload->>'zip' end) as zip
  from leads ld
  left join listings l on l.id = ld.listing_id
  left join properties p on p.id = coalesce(ld.property_id, l.property_id)`;

export type AdminAgent = {
  id: string;
  slug: string;
  displayName: string;
  email: string;
  brokerageName: string | null;
  status: string;
  isAcceptingLeads: boolean;
  zips: string[];
  leads30: number;
  open: number;
  responseTimeMinutes: number | null;
  createdAt: string;
};

export const AgentFilters = z.object({
  status: z.enum(["pending", "active", "suspended"]).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).catch(1).default(1),
});

export async function adminAgents(filters: z.infer<typeof AgentFilters>) {
  const q = filters.q ? `%${filters.q.toLowerCase()}%` : null;
  const rows = await sql<(AdminAgent & { total: number })[]>`
    select p.id, p.slug, p.display_name as "displayName", u.email, p.brokerage_name as "brokerageName", p.status,
      p.is_accepting_leads as "isAcceptingLeads", p.response_time_minutes as "responseTimeMinutes", p.created_at::text as "createdAt",
      coalesce((select array_agg(z.zip order by z.zip) from pro_zip_codes z where z.pro_id = p.id and (z.active_until is null or z.active_until > now())), '{}') as zips,
      (select count(*)::int from leads x where x.assigned_pro_id = p.id and x.created_at >= now() - interval '30 days') as leads30,
      (select count(*)::int from leads x where x.assigned_pro_id = p.id and x.status in ('new', 'contacted', 'qualified', 'touring')) as open,
      count(*) over ()::int as total
    from pros p join users u on u.id = p.user_id
    where p.pro_type = 'agent'
      ${filters.status ? sql`and p.status = ${filters.status}` : sql``}
      ${q ? sql`and (lower(p.display_name) like ${q} or lower(u.email) like ${q} or exists (select 1 from pro_zip_codes z where z.pro_id = p.id and z.zip like ${q}))` : sql``}
    order by p.status = 'pending' desc, p.display_name
    limit ${ADMIN_PAGE_SIZE} offset ${(filters.page - 1) * ADMIN_PAGE_SIZE}`;
  return { rows, total: rows[0]?.total ?? 0 };
}

export type AdminLead = {
  id: string;
  leadType: string;
  status: string;
  consumerName: string;
  consumerEmail: string;
  createdAt: string;
  source: "idx" | "site";
  zip: string | null;
  address: string | null;
  proName: string | null;
};

export const LeadFilters = z.object({
  status: z.enum(LEAD_STATUSES).optional().catch(undefined),
  source: z.enum(["idx", "site"]).optional().catch(undefined),
  zip: z.string().trim().regex(/^\d{5}$/).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).catch(1).default(1),
});

export async function adminLeads(filters: z.infer<typeof LeadFilters>) {
  const q = filters.q ? `%${filters.q.toLowerCase()}%` : null;
  const rows = await sql<(AdminLead & { total: number })[]>`
    with z as (${leadZips})
    select ld.id, ld.lead_type as "leadType", ld.status, ld.consumer_name as "consumerName", ld.consumer_email as "consumerEmail",
      ld.created_at::text as "createdAt",
      case when ld.external_ref like 'idx:%' then 'idx' else 'site' end as source,
      z.zip, coalesce(case when p.id is not null then concat_ws(', ', p.address_line1, p.city) end, nullif(ld.payload->>'address', '')) as address,
      pr.display_name as "proName",
      count(*) over ()::int as total
    from leads ld
    join z on z.lead_id = ld.id
    left join listings l on l.id = ld.listing_id
    left join properties p on p.id = coalesce(ld.property_id, l.property_id)
    left join pros pr on pr.id = ld.assigned_pro_id
    where true
      ${filters.status ? sql`and ld.status = ${filters.status}` : sql``}
      ${filters.source === "idx" ? sql`and ld.external_ref like 'idx:%'` : filters.source === "site" ? sql`and ld.external_ref is null` : sql``}
      ${filters.zip ? sql`and z.zip = ${filters.zip}` : sql``}
      ${q ? sql`and (lower(ld.consumer_name) like ${q} or lower(ld.consumer_email) like ${q})` : sql``}
    order by ld.created_at desc
    limit ${ADMIN_PAGE_SIZE} offset ${(filters.page - 1) * ADMIN_PAGE_SIZE}`;
  return { rows, total: rows[0]?.total ?? 0 };
}

export type ZipCoverage = { zip: string; agents: string[]; leads30: number; unassigned30: number };

/** Every ZIP code with an agent or a lead in the last 30 days; ZIPs with leads but no agent first. */
export async function zipCoverage(): Promise<ZipCoverage[]> {
  return sql<ZipCoverage[]>`
    with z as (${leadZips}),
    recent as (
      select z.zip, count(*)::int as leads30,
        count(*) filter (where ld.assigned_pro_id is null)::int as unassigned30
      from leads ld join z on z.lead_id = ld.id
      where ld.created_at >= now() - interval '30 days' and z.zip is not null
      group by z.zip
    ),
    covered as (
      select pz.zip, array_agg(p.display_name order by p.display_name) as agents
      from pro_zip_codes pz join pros p on p.id = pz.pro_id
      where p.status = 'active' and p.pro_type = 'agent' and (pz.active_until is null or pz.active_until > now())
      group by pz.zip
    )
    select coalesce(c.zip, r.zip) as zip, coalesce(c.agents, '{}') as agents,
      coalesce(r.leads30, 0) as leads30, coalesce(r.unassigned30, 0) as unassigned30
    from covered c full join recent r on r.zip = c.zip
    order by (c.zip is null) desc, coalesce(r.leads30, 0) desc, 1
    limit 500`;
}
