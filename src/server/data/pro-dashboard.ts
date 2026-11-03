import "server-only";
import { sqlClient } from "@/db";
import { market } from "@/config/market";
import { inbox, inboxStats, type InboxLead } from "./pro-leads";

/** The agent overview: leads waiting for a first reply, this month's numbers, closings this year. */
export async function proDashboard(proId: string, capPerDay: number): Promise<{ waitingReply: InboxLead[]; stats: Awaited<ReturnType<typeof inboxStats>>; closedThisYear: number }> {
  const [fresh, stats, [closed]] = await Promise.all([
    inbox(proId, { status: "new" }),
    inboxStats(proId, capPerDay),
    sqlClient<{ n: number }[]>`
      select count(*)::int as n from leads where assigned_pro_id = ${proId} and status = 'closed'
        and coalesce(close_date, (status_changed_at at time zone ${market.timezone})::date) >= date_trunc('year', now() at time zone ${market.timezone})::date`,
  ]);
  return { waitingReply: fresh.filter((l) => !l.firstResponseAt).slice(0, 5), stats, closedThisYear: closed.n };
}
