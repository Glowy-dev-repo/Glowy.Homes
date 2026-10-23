import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader, Panel, Stat } from "@/components/admin/AdminPage";
import { formatNumber } from "@/lib/format";
import { leadStats } from "@/server/data/admin";
import { adminCounts, adminLeadCards, setupChecklist } from "@/server/data/admin-dashboard";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const TYPE: Record<string, string> = { tour: "Tour request", contact: "Question", sell: "Selling", rental_inquiry: "Rental question", rental_application: "Rental application" };

function Attention({ ok, text, href, action }: { ok: boolean; text: string; href: string; action: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 py-3 last:border-0">
      <span className="flex items-center gap-3 text-body">
        {ok ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden /> : <CircleAlert className="size-5 shrink-0 text-accent" aria-hidden />}
        {text}
      </span>
      {!ok && (
        <Link href={href} className="inline-flex min-h-11 items-center gap-1 font-medium text-accent hover:underline">
          {action} <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </li>
  );
}

export default async function AdminHome() {
  const [counts, stats, waiting] = await Promise.all([adminCounts(), leadStats(), adminLeadCards("waiting", { limit: 5 })]);
  const setup = setupChecklist();
  const setupLeft = setup.filter((s) => !s.done).length;

  return (
    <div className="space-y-6">
      <AdminHeader title="Home" description="What needs your attention today, and how Glowy Homes is doing." />

      <Panel title="Needs your attention" testId="attention">
        <ul>
          <Attention
            ok={counts.waiting === 0}
            text={counts.waiting === 0 ? "Every lead has an agent." : `${counts.waiting} ${counts.waiting === 1 ? "lead is" : "leads are"} waiting for you to choose an agent.`}
            href="/admin/leads"
            action="Assign agents"
          />
          <Attention
            ok={counts.approvals === 0}
            text={counts.approvals === 0 ? "Nothing waiting for approval." : `${counts.approvals} ${counts.approvals === 1 ? "item needs" : "items need"} approval (new agents, listings, home claims or reviews).`}
            href="/admin/moderation"
            action="Review"
          />
          <Attention
            ok={setupLeft === 0}
            text={setupLeft === 0 ? "The site is fully set up." : `${setupLeft} setup ${setupLeft === 1 ? "step is" : "steps are"} left before the site is fully live.`}
            href="/admin/system"
            action="See settings"
          />
        </ul>
      </Panel>

      <section aria-labelledby="numbers-h">
        <h2 id="numbers-h" className="sr-only">Key numbers</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Leads waiting" value={formatNumber(counts.waiting)} href="/admin/leads" tone={counts.waiting ? "attention" : "plain"} testId="stat-unassigned" />
          <Stat label="Leads, last 7 days" value={formatNumber(counts.leadsWeek)} href="/admin/leads?view=all" />
          <Stat label="Leads, last 30 days" value={formatNumber(counts.leadsMonth)} href="/admin/leads?view=all" />
          <Stat label="Active partner agents" value={formatNumber(counts.activeAgents)} href="/admin/agents?status=active" />
          <Stat label="Homes for sale" value={formatNumber(counts.forSale)} testId="stat-active" />
          <Stat label="Homes for rent" value={formatNumber(counts.forRent)} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Oldest leads waiting" description="Assign these first: customers expect a reply within a few hours.">
          {waiting.length === 0 ? (
            <p className="text-body text-neutral-600">No leads waiting.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {waiting.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.consumerName} · {TYPE[l.leadType] ?? l.leadType}</p>
                    <p className="truncate text-small text-neutral-600">{l.address ?? (l.zip ? `ZIP ${l.zip}` : "No home yet")}</p>
                  </div>
                  <Link href={`/admin/leads?lead=${l.id}`} className="shrink-0 text-small font-medium text-accent hover:underline">Assign</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Leads by area, last 30 days" testId="lead-stats">
          {stats.byCity.length === 0 ? (
            <p className="text-body text-neutral-600">No leads in the last 30 days.</p>
          ) : (
            <table className="w-full text-left text-body">
              <caption className="sr-only">Leads by area</caption>
              <thead>
                <tr className="border-b border-neutral-200 text-small text-neutral-600">
                  <th scope="col" className="py-2 pr-3 font-medium">Area</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Leads</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Waiting</th>
                  <th scope="col" className="py-2 text-right font-medium">Closed</th>
                </tr>
              </thead>
              <tbody>
                {stats.byCity.slice(0, 8).map((c) => (
                  <tr key={c.city} className="border-b border-neutral-100 last:border-0">
                    <td className="py-2 pr-3">{c.city}</td>
                    <td className="tabular py-2 pr-3 text-right">{c.total}</td>
                    <td className="tabular py-2 pr-3 text-right">{c.unassigned}</td>
                    <td className="tabular py-2 text-right">{c.closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
