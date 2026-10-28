import "server-only";
import { sqlClient } from "@/db";
import type { ProStatus, ProStatusLogEntry } from "@/db/schema/agents";

const sql = sqlClient;

export type AdminAgentDetail = {
  id: string;
  slug: string;
  proType: string;
  displayName: string;
  email: string;
  phone: string | null;
  brokerageName: string | null;
  licenseNumber: string | null;
  licenseVerifiedAt: string | null;
  agreementVersion: string | null;
  agreementAcceptedAt: string | null;
  status: ProStatus;
  isAcceptingLeads: boolean;
  statusLog: ProStatusLogEntry[];
  zips: string[];
  createdAt: string;
  leads30: number;
  closed: number;
  openLeads: { id: string; consumerName: string; leadType: string; status: string; assignedAt: string | null }[];
};

/** The DRE public license lookup for a license number (a link for admins; we never fetch it). */
export const dreLookupUrl = (license: string) => `https://www2.dre.ca.gov/PublicASP/pplinfo.asp?License_id=${encodeURIComponent(license)}`;

export async function adminAgentDetail(id: string): Promise<AdminAgentDetail | null> {
  const [row] = await sql<AdminAgentDetail[]>`
    select p.id, p.slug, p.pro_type as "proType", p.display_name as "displayName", u.email, p.phone, p.brokerage_name as "brokerageName",
      p.license_number as "licenseNumber", p.license_verified_at::text as "licenseVerifiedAt",
      p.agreement_version as "agreementVersion", p.agreement_accepted_at::text as "agreementAcceptedAt",
      p.status, p.is_accepting_leads as "isAcceptingLeads", p.status_log as "statusLog", p.created_at::text as "createdAt",
      coalesce(array(select zip from pro_zip_codes where pro_id = p.id order by zip), '{}') as zips,
      (select count(*)::int from leads x where x.assigned_pro_id = p.id and x.created_at >= now() - interval '30 days') as leads30,
      (select count(*)::int from leads x where x.assigned_pro_id = p.id and x.status = 'closed') as closed,
      coalesce((select json_agg(json_build_object('id', x.id, 'consumerName', x.consumer_name, 'leadType', x.lead_type, 'status', x.status, 'assignedAt', x.assigned_at) order by x.assigned_at desc)
        from leads x where x.assigned_pro_id = p.id and x.status not in ('closed', 'lost')), '[]'::json) as "openLeads"
    from pros p join users u on u.id = p.user_id
    where p.id = ${id}`;
  return row ?? null;
}
