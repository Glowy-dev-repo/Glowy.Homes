"use client";

import { useEffect, useId, useState } from "react";
import { estimateCommute, type CommuteEstimate } from "@/lib/commute";
import type { Suggestion } from "@/lib/search/autocomplete";

/** Commute time input (docs/01 LDP section 11): pick a destination, see a travel time range. */
export function CommuteEstimator({ from }: { from: [number, number] }) {
  const id = useId();
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<Suggestion[]>([]);
  const [chosen, setChosen] = useState<{ label: string; estimate: CommuteEstimate } | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setOptions([]);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const body = (await res.json()) as { data: Suggestion[] | null };
        setOptions((body.data ?? []).filter((s) => s.point));
      } catch {
        // aborted
      }
    }, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  return (
    <div>
      <label htmlFor={`${id}-dest`} className="mb-1 block text-small font-medium text-neutral-800">
        Commute to
      </label>
      <input
        id={`${id}-dest`}
        type="text"
        list={`${id}-list`}
        value={q}
        placeholder="A neighbourhood, city or address"
        onChange={(e) => {
          const value = e.target.value;
          setQ(value);
          const match = options.find((o) => `${o.label}, ${o.sublabel}` === value);
          if (match?.point) setChosen({ label: match.label, estimate: estimateCommute(from, match.point) });
        }}
        className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:border-accent"
      />
      <datalist id={`${id}-list`}>
        {options.map((o) => (
          <option key={o.href} value={`${o.label}, ${o.sublabel}`} />
        ))}
      </datalist>
      {chosen && (
        <div className="mt-3 rounded-md bg-neutral-50 p-3 text-body" aria-live="polite" data-testid="commute-estimate">
          <p>
            To {chosen.label}: about {chosen.estimate.distanceKm} km in a straight line.
          </p>
          <p className="tabular">
            By car: {chosen.estimate.car[0]} to {chosen.estimate.car[1]} min. By transit: {chosen.estimate.transit[0]} to {chosen.estimate.transit[1]} min.
          </p>
          <p className="text-small text-neutral-700">Confidence: <span className="font-semibold">Low</span></p>
          <p className="text-small text-neutral-600">
            This is an estimate, not a trip plan. Actual time depends on the route, traffic and transit schedules.
          </p>
        </div>
      )}
    </div>
  );
}
