import type postgres from "postgres";
import { brand } from "@/config/brand";
import { sendEmail } from "@/lib/email";
import { adminNoReplyEmail, proLeadReminderEmail } from "@/lib/email/templates/pros";

type Sql = postgres.Sql | postgres.TransactionSql;
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? `https://${brand.domain}`;

/**
 * After admin assigns a lead (inngest lead-follow-up): if the agent has not replied, first remind them,
 * then tell every admin so they can choose another agent. Glowy Homes chooses agents, so nothing here
 * reassigns the lead. Returns "responded" once the agent replied, moved the lead on, or it was reassigned.
 */
export async function followUpAssigned(sql: Sql, leadId: string, proId: string, stage: "remind" | "escalate"): Promise<"responded" | "reminded" | "escalated"> {
  const [lead] = await sql<{ assigned: string | null; responded: boolean; status: string; leadType: string; address: string | null; assignedAt: string | null; agentName: string; agentEmail: string }[]>`
    select ld.assigned_pro_id as assigned, ld.first_response_at is not null as responded, ld.status, ld.lead_type as "leadType",
      concat_ws(', ', concat_ws(' ', p.address_line2, p.address_line1), p.city) as address, ld.assigned_at::text as "assignedAt",
      pr.display_name as "agentName", u.email as "agentEmail"
    from leads ld
    left join listings l on l.id = ld.listing_id
    left join properties p on p.id = coalesce(ld.property_id, l.property_id)
    join pros pr on pr.id = ld.assigned_pro_id
    join users u on u.id = pr.user_id
    where ld.id = ${leadId}`;
  if (!lead || lead.assigned !== proId || lead.responded || lead.status !== "new") return "responded";

  const action = stage === "remind" ? "reminder_sent" : "no_response";
  const entry = { at: new Date().toISOString(), action, pro_id: proId, reason: stage === "remind" ? "no reply yet, agent reminded" : "no reply after a reminder, admins told" };
  await sql`update leads set routing_log = routing_log || ${sql.json([entry] as never)} where id = ${leadId}`;

  if (stage === "remind") {
    await sendEmail({ to: lead.agentEmail, ...proLeadReminderEmail({ appUrl: appUrl(), leadId, leadType: lead.leadType, address: lead.address || null }) }).catch((e) => console.warn(`[leads] reminder failed: ${e}`));
    return "reminded";
  }
  const minutes = lead.assignedAt ? Math.max(1, Math.round((Date.now() - Date.parse(lead.assignedAt)) / 60_000)) : 0;
  const admins = await sql<{ email: string }[]>`select email from users where 'admin' = any(roles)`;
  for (const a of admins) {
    await sendEmail({ to: a.email, ...adminNoReplyEmail({ appUrl: appUrl(), leadId, agentName: lead.agentName, minutes }) }).catch(() => {});
  }
  return "escalated";
}
