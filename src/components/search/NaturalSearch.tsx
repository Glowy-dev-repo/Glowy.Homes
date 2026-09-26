"use client";

import { Loader2, Sparkles, X } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { describeParams, removeChip } from "@/lib/nl-search/chips";
import { toQueryString } from "@/lib/search/url";
import type { SearchParamsInput } from "@/types/search";

/**
 * Natural language search (docs/05 Phase 6 task 2): the text becomes filters, shown as chips the
 * user can remove before running the search. Everything stays editable in the filter bar after.
 */
export function NaturalSearch() {
  const id = useId();
  const [text, setText] = useState("");
  const [params, setParams] = useState<SearchParamsInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parse = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/search/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const body = (await res.json().catch(() => null)) as { data?: { params: SearchParamsInput }; error?: { message: string; fields?: Record<string, string[]> } } | null;
    setBusy(false);
    if (!res.ok || !body?.data) return setError(body?.error?.fields?.text?.[0] ?? body?.error?.message ?? "We could not read that. Try the filters instead.");
    setParams(body.data.params);
  };

  const chips = params ? describeParams(params) : [];
  return (
    <div className="pb-3">
      <form onSubmit={parse} className="flex gap-2" role="search" aria-label="Search by description">
        <label htmlFor={`${id}-nl`} className="sr-only">Describe the home you want</label>
        <div className="relative min-w-0 flex-1">
          <Sparkles className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" aria-hidden />
          <input
            id={`${id}-nl`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            placeholder="Or describe it: 3 bed condo under 900k with parking"
            className="h-11 w-full rounded-md border border-neutral-300 bg-white pl-9 pr-3 text-base placeholder:text-neutral-500"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={busy || text.trim().length < 3}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}Read it
        </Button>
      </form>
      {error && <p role="alert" className="mt-2 text-small text-danger">{error}</p>}
      {params && (
        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="nl-chips">
          <span className="text-small text-neutral-600">We understood:</span>
          {chips.map((c) =>
            c.id === "type" ? (
              <span key={c.id} className="inline-flex min-h-11 items-center rounded-pill bg-neutral-100 px-3 text-small font-medium">{c.label}</span>
            ) : (
              <button
                key={c.id}
                type="button"
                onClick={() => setParams(removeChip(params, c))}
                className="inline-flex min-h-11 items-center gap-1 rounded-pill bg-accent/10 px-3 text-small font-medium text-accent hover:bg-accent/15"
                aria-label={`Remove ${c.label}`}
              >
                {c.label}
                <X className="size-3.5" aria-hidden />
              </button>
            ),
          )}
          <Button onClick={() => window.location.assign(`/search?${toQueryString(params)}`)}>Show homes</Button>
        </div>
      )}
    </div>
  );
}
