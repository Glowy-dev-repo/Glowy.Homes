import { CalendarDays, MessageSquare, Star } from "lucide-react";
import Link from "next/link";
import { brand } from "@/config/brand";
import type { LeadType } from "@/db/schema/leads";
import type { LocalAgent } from "@/server/data/pros";
import { LeadDialog } from "./LeadDialog";

export function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

/** "Typically replies in about 15 minutes": a typical time, never a promise. */
export function replyTime(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `Typically replies in about ${Math.max(5, Math.round(minutes / 5) * 5)} minutes`;
  const hours = Math.round(minutes / 60);
  return `Typically replies in about ${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/**
 * The listing page's contact card: a partner agent who serves the home's ZIP code, with tour and question
 * buttons. Requests go to the Glowy Homes team, who choose the agent, and never to the listing agent
 * (CSMAR Rule 12.16.22).
 */
export function LocalAgentCard({
  agent,
  zip,
  listingId,
  address,
  questionType,
}: {
  agent: LocalAgent | null;
  zip: string | null;
  listingId: string;
  address: string;
  questionType: LeadType;
}) {
  const where = zip ? `ZIP ${zip}` : "this area";
  // Glowy Homes chooses the agent for every lead, so the card never preselects the agent it shows.
  const note = `Your request goes to the ${brand.name} team, who connect you with a partner agent who serves ${where}. It does not go to the listing agent.`;
  const reply = agent ? replyTime(agent.responseTimeMinutes) : null;

  return (
    <section aria-labelledby="local-agent-heading" className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card" data-testid="local-agent">
      <h2 id="local-agent-heading" className="font-sans text-label uppercase tracking-[0.14em] text-neutral-600">
        Local partner agents for {where}
      </h2>
      {agent ? (
        <div className="mt-3 flex items-center gap-3">
          <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-accent/10 text-h3 font-semibold text-accent">
            {initials(agent.displayName)}
          </span>
          <div className="min-w-0">
            <Link href={`/agent/${agent.slug}`} className="block text-h3 font-semibold text-neutral-900 hover:underline" data-testid="local-agent-name">
              {agent.displayName}
            </Link>
            {agent.brokerageName && <p className="truncate text-small text-neutral-600">{agent.brokerageName}</p>}
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-small text-neutral-700">
              {agent.rating && agent.reviewCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-4 fill-warning text-warning" aria-hidden />
                  {agent.rating.toFixed(1)} ({agent.reviewCount})
                </span>
              ) : null}
              {reply && <span>{reply}</span>}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-body text-neutral-800">
          Send a request and we will connect you with a local partner agent.
        </p>
      )}

      <div className="mt-4 grid gap-2">
        <LeadDialog
          leadType="tour"
          listingId={listingId}
          address={address}
          recipientNote={note}
          triggerClassName="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-accent px-4 font-semibold text-white hover:bg-accent-hover"
          trigger={
            <>
              <CalendarDays className="size-5" aria-hidden />
              Request a tour
            </>
          }
        />
        <LeadDialog
          leadType={questionType}
          listingId={listingId}
          address={address}
          recipientNote={note}
          triggerClassName="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-accent px-4 font-semibold text-accent hover:bg-accent/5"
          trigger={
            <>
              <MessageSquare className="size-5" aria-hidden />
              Ask a local agent
            </>
          }
        />
      </div>
      <p className="mt-3 text-small text-neutral-600" data-testid="cta-note">
        {note}
      </p>
    </section>
  );
}
