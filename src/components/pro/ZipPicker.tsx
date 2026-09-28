"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import type { ZipOption } from "@/lib/zips";

export const MAX_ZIP_CODES = 30;

const HOME_TYPES = [
  ["detached", "Single family"],
  ["condo", "Condo"],
  ["townhouse", "Townhouse"],
  ["multi", "Multi unit"],
  ["semi", "Semi detached"],
  ["land", "Land"],
] as const;

/** ZIP codes an agent receives leads for, grouped by city. */
export function ZipPicker({ zips, value, onChange, error }: { zips: ZipOption[]; value: string[]; onChange: (zips: string[]) => void; error?: string }) {
  const cities = [...new Map(zips.map((z) => [z.citySlug, z.cityName])).entries()];
  const toggle = (zip: string, on: boolean) => onChange(on ? [...new Set([...value, zip])] : value.filter((v) => v !== zip));
  const toggleCity = (slug: string, on: boolean) => {
    const cityZips = zips.filter((z) => z.citySlug === slug).map((z) => z.zip);
    onChange(on ? [...new Set([...value, ...cityZips])].slice(0, MAX_ZIP_CODES) : value.filter((v) => !cityZips.includes(v)));
  };
  return (
    <fieldset aria-describedby={error ? "zips-error" : undefined} data-testid="zip-picker">
      <legend className="mb-1 text-small font-medium text-neutral-800">ZIP codes you serve (up to {MAX_ZIP_CODES})</legend>
      <p className="mb-2 text-small text-neutral-600">Inquiries on homes in these ZIP codes can be sent to you.</p>
      {error && (
        <p id="zips-error" role="alert" className="mb-2 text-small text-danger">
          {error}
        </p>
      )}
      <div className="space-y-3">
        {cities.map(([slug, name]) => {
          const cityZips = zips.filter((z) => z.citySlug === slug);
          const all = cityZips.every((z) => value.includes(z.zip));
          return (
            <details key={slug} className="rounded-md border border-neutral-200 px-3" open={cityZips.some((z) => value.includes(z.zip)) || undefined}>
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3">
                <span className="text-body font-medium">{name}</span>
                <span className="text-small text-neutral-600">{cityZips.filter((z) => value.includes(z.zip)).length} of {cityZips.length} selected</span>
              </summary>
              <label className="flex min-h-11 items-center gap-3 text-body text-neutral-800">
                <input type="checkbox" checked={all} onChange={(e) => toggleCity(slug, e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
                All ZIP codes in {name}
              </label>
              <div className="grid grid-cols-2 gap-x-4 pb-3 sm:grid-cols-4">
                {cityZips.map((z) => (
                  <label key={z.zip} className="flex min-h-11 items-center gap-3 text-body text-neutral-800">
                    <input
                      type="checkbox"
                      checked={value.includes(z.zip)}
                      onChange={(e) => toggle(z.zip, e.target.checked)}
                      className="size-5 accent-[var(--color-accent)]"
                      aria-label={`ZIP ${z.zip}, ${name}`}
                    />
                    <span className="tabular">{z.zip}</span>
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>
      <p className="mt-2 text-small text-neutral-600">{value.length} selected</p>
    </fieldset>
  );
}

export type LeadPrefs = { priceMin: string; priceMax: string; homeTypes: string[] };

/** What leads suit the agent best: those rank first when several agents cover a ZIP code. */
export function LeadPreferences({ value, onChange }: { value: LeadPrefs; onChange: (v: LeadPrefs) => void }) {
  const id = useId();
  const toggle = (t: string, on: boolean) => onChange({ ...value, homeTypes: on ? [...new Set([...value.homeTypes, t])] : value.homeTypes.filter((x) => x !== t) });
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-small font-medium text-neutral-800">Leads that suit you best (optional)</legend>
      <p className="text-small text-neutral-600">When several agents cover a ZIP code, inquiries go first to the agent whose price range and home types match the home.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <label htmlFor={`${id}-min`} className="text-small text-neutral-700">Lowest home price ($)</label>
          <Input id={`${id}-min`} type="number" inputMode="numeric" min={0} step={10000} value={value.priceMin} onChange={(e) => onChange({ ...value, priceMin: e.target.value })} />
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${id}-max`} className="text-small text-neutral-700">Highest home price ($)</label>
          <Input id={`${id}-max`} type="number" inputMode="numeric" min={0} step={10000} value={value.priceMax} onChange={(e) => onChange({ ...value, priceMax: e.target.value })} />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5">
        {HOME_TYPES.map(([t, label]) => (
          <label key={t} className="flex min-h-11 items-center gap-2 text-body text-neutral-800">
            <input type="checkbox" checked={value.homeTypes.includes(t)} onChange={(e) => toggle(t, e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function prefsToPayload(p: LeadPrefs) {
  return {
    priceMin: p.priceMin ? Number(p.priceMin) : null,
    priceMax: p.priceMax ? Number(p.priceMax) : null,
    homeTypes: p.homeTypes,
  };
}
