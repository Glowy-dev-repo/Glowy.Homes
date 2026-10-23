import { Clock, Home, Mail, MessageSquare, Phone } from "lucide-react";
import { ReassignForm } from "@/components/admin/ReassignForm";
import { formatDate } from "@/lib/format";
import type { AdminLeadCard } from "@/server/data/admin-dashboard";

const TYPE: Record<string, string> = { tour: "Tour request", contact: "Question", sell: "Selling a home", rental_inquiry: "Rental question", rental_application: "Rental application" };

function waited(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  return formatDate(iso);
}

/** One lead, with everything needed to choose its agent without opening anything else. */
export function LeadCard({ lead, pros }: { lead: AdminLeadCard; pros: { id: string; displayName: string; proType: string; covers: boolean }[] }) {
  return (
    <li data-lead-id={lead.id} className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-h3">{lead.consumerName}</p>
          <p className="mt-0.5 text-small text-neutral-600">
            {TYPE[lead.leadType] ?? lead.leadType.replace(/_/g, " ")} · {lead.source === "idx" ? "IDX listing search" : "Our website"} ·{" "}
            {lead.proName ? `with ${lead.proName}` : "waiting for an agent"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-pill bg-neutral-100 px-2.5 py-1 text-small text-neutral-700">
          <Clock className="size-4" aria-hidden /> {waited(lead.createdAt)}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 text-body sm:grid-cols-2">
        <div className="flex gap-2">
          <dt><Home className="mt-0.5 size-4 text-neutral-500" aria-label="Home" /></dt>
          <dd>{lead.address ?? "No home chosen"}{lead.zip ? <span className="text-neutral-600"> · ZIP {lead.zip}</span> : null}{lead.area ? <span className="text-neutral-600"> · {lead.area}</span> : null}</dd>
        </div>
        <div className="flex gap-2">
          <dt><Mail className="mt-0.5 size-4 text-neutral-500" aria-label="Email" /></dt>
          <dd className="min-w-0 break-all"><a href={`mailto:${lead.consumerEmail}`} className="text-accent hover:underline">{lead.consumerEmail}</a></dd>
        </div>
        {lead.consumerPhone && (
          <div className="flex gap-2">
            <dt><Phone className="mt-0.5 size-4 text-neutral-500" aria-label="Phone" /></dt>
            <dd><a href={`tel:${lead.consumerPhone}`} className="text-accent hover:underline">{lead.consumerPhone}</a></dd>
          </div>
        )}
        {lead.message && (
          <div className="flex gap-2 sm:col-span-2">
            <dt><MessageSquare className="mt-0.5 size-4 text-neutral-500" aria-label="Message" /></dt>
            <dd className="text-neutral-800">{lead.message.length > 280 ? `${lead.message.slice(0, 280)}…` : lead.message}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
        {!lead.proName ? (
          <p className="text-small text-neutral-800" data-testid="suggested-agent">
            {lead.suggestedName
              ? `Suggested: ${lead.suggestedName} (covers this ZIP code)`
              : lead.note && !lead.note.startsWith("waiting for Glowy Homes")
                ? `No suggestion: ${lead.note}`
                : "No partner agent covers this ZIP code yet"}
          </p>
        ) : (
          <p className="text-small text-neutral-600">Agent: <span className="font-medium text-neutral-900">{lead.proName}</span></p>
        )}
        <ReassignForm leadId={lead.id} pros={pros} suggestedId={lead.suggestedProId} assigned={!!lead.proName} />
      </div>
    </li>
  );
}
