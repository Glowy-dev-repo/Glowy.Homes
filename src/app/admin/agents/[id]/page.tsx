import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader, Panel, Stat } from "@/components/admin/AdminPage";
import { AgentStatusForm } from "@/components/admin/AgentStatusForm";
import { formatDate } from "@/lib/format";
import { isUuid } from "@/lib/listings/detail";
import { allowedActions } from "@/lib/pros/status-rules";
import { adminAgentDetail, dreLookupUrl } from "@/server/data/admin-agent";

export const metadata: Metadata = { title: "Admin agent", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Waiting for approval", cls: "bg-warning/15" },
  active: { label: "Active", cls: "bg-success/15" },
  suspended: { label: "Suspended", cls: "bg-danger/10" },
};
const ACTION: Record<string, string> = { approve: "Approved", reject: "Not approved", suspend: "Suspended", reactivate: "Reactivated" };
const TYPE: Record<string, string> = { tour: "Tour request", contact: "Question", sell: "Selling", rental_inquiry: "Rental question", rental_application: "Rental application" };

export default async function AdminAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const a = await adminAgentDetail(id);
  if (!a) notFound();
  const status = STATUS[a.status];

  return (
    <div className="space-y-6">
      <p>
        <Link href="/admin/agents" className="text-small font-medium text-accent hover:underline">All agents</Link>
      </p>
      <AdminHeader title={a.displayName} description={[a.brokerageName, a.email, a.phone].filter(Boolean).join(" · ")}>
        <span className={`rounded px-2 py-1 text-small font-medium text-neutral-900 ${status.cls}`} data-testid="agent-status">{status.label}</span>
      </AdminHeader>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="License and agreement" testId="agent-license">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
            <dt className="text-neutral-600">DRE license</dt>
            <dd>
              {a.licenseNumber ? (
                <a href={dreLookupUrl(a.licenseNumber)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                  {a.licenseNumber}, check on the DRE site <ExternalLink className="size-4" aria-hidden />
                </a>
              ) : (
                "Not given"
              )}
            </dd>
            <dt className="text-neutral-600">License checked</dt>
            <dd>{a.licenseVerifiedAt ? formatDate(a.licenseVerifiedAt) : "Not yet"}</dd>
            <dt className="text-neutral-600">Partner agreement</dt>
            <dd>{a.agreementAcceptedAt ? `Version ${a.agreementVersion}, accepted ${formatDate(a.agreementAcceptedAt)}` : "Not accepted"}</dd>
            <dt className="text-neutral-600">Joined</dt>
            <dd>{formatDate(a.createdAt)}</dd>
            <dt className="text-neutral-600">Public profile</dt>
            <dd>{a.status === "active" ? <Link href={`/agent/${a.slug}`} className="font-medium text-accent hover:underline">View profile</Link> : "Hidden until active"}</dd>
          </dl>
          {a.status === "pending" && (
            <p className="mt-4 text-small text-neutral-600">Open the DRE site, confirm the name matches and the license is active, then approve.</p>
          )}
          <div className="mt-4">
            <AgentStatusForm proId={a.id} actions={allowedActions(a.status)} />
          </div>
        </Panel>

        <Panel title="History" testId="agent-history">
          {a.statusLog.length === 0 ? (
            <p className="text-body text-neutral-600">No changes yet.</p>
          ) : (
            <ol className="space-y-3">
              {[...a.statusLog].reverse().map((e, i) => (
                <li key={i} className="border-b border-neutral-100 pb-3 last:border-0">
                  <p className="font-medium">{ACTION[e.action] ?? e.action} · {formatDate(e.at)}</p>
                  {e.reason && <p className="text-small text-neutral-700">{e.reason}</p>}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Leads, last 30 days" value={a.leads30} />
        <Stat label="Open leads" value={a.openLeads.length} tone={a.status === "suspended" && a.openLeads.length ? "attention" : "plain"} />
        <Stat label="Closed" value={a.closed} />
        <Stat label="ZIP codes" value={a.zips.length} />
      </div>

      <Panel
        title="Open leads"
        description={a.status === "suspended" && a.openLeads.length ? "This agent is suspended. Assign these leads to another partner agent." : undefined}
        testId="agent-open-leads"
      >
        {a.openLeads.length === 0 ? (
          <p className="text-body text-neutral-600">No open leads.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {a.openLeads.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 truncate">{l.consumerName} · {TYPE[l.leadType] ?? l.leadType} · {l.status}</span>
                <Link href={`/admin/leads?lead=${l.id}`} className="shrink-0 text-small font-medium text-accent hover:underline">Open lead</Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="ZIP codes served">
        {a.zips.length ? (
          <ul className="flex flex-wrap gap-1">
            {a.zips.map((z) => (
              <li key={z}>
                <Link href={`/admin/leads?zip=${z}`} className="tabular rounded bg-neutral-100 px-1.5 py-0.5 text-small hover:bg-neutral-200">{z}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-neutral-600">None chosen.</p>
        )}
      </Panel>
    </div>
  );
}
