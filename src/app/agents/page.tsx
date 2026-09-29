import { MapPin, MessageSquare, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LeadDialog } from "@/components/lead/LeadDialog";
import { initials, replyTime } from "@/components/lead/LocalAgentCard";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { market } from "@/config/market";
import { localAgents } from "@/server/data/pros";

export const metadata: Metadata = {
  title: "Local agents",
  description: `Enter a ZIP code to meet the ${brand.name} partner agents who serve it, and ask a question or request a tour.`,
  alternates: { canonical: "/agents" },
};

type Props = { searchParams: Promise<{ zip?: string }> };

/** Local agents: the partner agents serving a ZIP code, best match first (the one lead routing picks). */
export default async function LocalAgentsPage({ searchParams }: Props) {
  const raw = ((await searchParams).zip ?? "").trim();
  const zip = raw.slice(0, 5);
  const invalid = raw !== "" && !/^\d{5}$/.test(zip);
  const agents = raw && !invalid ? await localAgents(zip) : [];

  return (
    <div className="container-page py-10 md:py-14">
      <div className="max-w-2xl">
        <p className="text-label uppercase tracking-[0.18em] text-accent">Local agents</p>
        <h1 className="mt-2 text-h1 md:text-display">Meet the agent for your ZIP code</h1>
        <p className="mt-3 text-body text-neutral-700">
          Every {brand.name} partner agent serves a few ZIP codes they know well. Enter yours to see who covers it, then ask a question or request a tour.
        </p>

        <form action="/agents" method="get" className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end" role="search">
          <div className="grid flex-1 gap-1.5">
            <label htmlFor="zip" className="text-small font-medium text-neutral-800">
              {market.postalLabel}
            </label>
            <input
              id="zip"
              name="zip"
              defaultValue={raw}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={10}
              placeholder="5 digits"
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? "zip-error" : undefined}
              className="min-h-12 rounded-md border border-neutral-300 bg-white px-4 text-body text-neutral-900 placeholder:text-neutral-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <Button type="submit" className="min-h-12 px-6">
            Find my agent
          </Button>
        </form>
        {invalid && (
          <p id="zip-error" role="alert" className="mt-2 text-small text-danger">
            Enter a 5 digit {market.postalLabel}.
          </p>
        )}
      </div>

      {raw && !invalid && (
        <section aria-labelledby="results-heading" className="mt-10" data-testid="zip-agents">
          <h2 id="results-heading" className="text-h2">
            {agents.length ? `Partner agents for ZIP ${zip}` : `No partner agent covers ZIP ${zip} yet`}
          </h2>
          {agents.length === 0 ? (
            <p className="mt-2 max-w-2xl text-body text-neutral-700">
              You can still ask about any home on {brand.name}: we will connect you with a partner agent nearby. Or browse agents by city below.
            </p>
          ) : (
            <ul className="mt-5 grid gap-4 md:grid-cols-2">
              {agents.slice(0, 6).map((a, i) => (
                <li key={a.id} className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-card" data-testid="zip-agent">
                  <div className="flex items-center gap-4">
                    <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-accent/10 text-h3 font-semibold text-accent">
                      {initials(a.displayName)}
                    </span>
                    <div className="min-w-0">
                      {i === 0 && (
                        <span className="mb-1 inline-block rounded-pill bg-accent/10 px-2.5 py-0.5 text-[13px] font-semibold text-accent" data-testid="best-match">
                          Best match
                        </span>
                      )}
                      <Link href={`/agent/${a.slug}`} className="block text-h3 font-semibold text-neutral-900 hover:underline">
                        {a.displayName}
                      </Link>
                      {a.brokerageName && <p className="truncate text-small text-neutral-600">{a.brokerageName}</p>}
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-small text-neutral-700">
                        {a.rating && a.reviewCount > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Star className="size-4 fill-warning text-warning" aria-hidden />
                            {a.rating.toFixed(1)} ({a.reviewCount})
                          </span>
                        ) : null}
                        {a.yearsExperience ? <span>{a.yearsExperience} years</span> : null}
                      </p>
                      {replyTime(a.responseTimeMinutes) && <p className="text-small text-neutral-600">{replyTime(a.responseTimeMinutes)}</p>}
                    </div>
                  </div>
                  <LeadDialog
                    leadType="contact"
                    proId={a.id}
                    recipientNote={`This goes to ${a.displayName}, a ${brand.name} partner agent for ZIP ${zip}.`}
                    triggerClassName="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-accent px-4 font-semibold text-accent hover:bg-accent/5"
                    trigger={
                      <>
                        <MessageSquare className="size-5" aria-hidden />
                        Ask {a.displayName.split(" ")[0]} a question
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="cities-heading" className="mt-12 border-t border-neutral-200 pt-8">
        <h2 id="cities-heading" className="text-h3 font-semibold">
          Browse agents by city
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {brand.market.cities.map((c) => (
            <li key={c.slug}>
              <Link href={`/agents/${c.slug}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-neutral-300 px-4 text-small hover:border-neutral-400">
                <MapPin className="size-4 text-neutral-500" aria-hidden />
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
