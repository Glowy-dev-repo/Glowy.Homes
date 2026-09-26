"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { areaUnitLabel, formatPrice, fromSqft, toSqft } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SearchParams } from "@/types/search";
import { BATH_OPTIONS, BED_OPTIONS, DAYS_ON_MARKET, HOME_TYPES, RENT_PRICES, SALE_PRICES } from "./filter-options";

export type FilterSection = "type" | "price" | "beds" | "baths" | "homeType" | "status" | "size" | "more" | "rental";

type Props = {
  draft: SearchParams;
  onChange: (patch: Partial<SearchParams>) => void;
  sections: FilterSection[];
};

const fieldLabel = "mb-2 block text-small font-semibold text-neutral-900";

function Segmented<T extends number>({
  label,
  value,
  options,
  format,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: T[];
  format: (v: T) => string;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <fieldset>
      <legend className={fieldLabel}>{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = o === 0 ? value === undefined || value === 0 : value === o;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(o === 0 ? undefined : o)}
              className={cn(
                "min-h-11 min-w-14 rounded-md border px-3 text-body font-medium transition-colors duration-150",
                selected ? "border-accent bg-accent/10 text-accent" : "border-neutral-300 text-neutral-800 hover:border-neutral-400",
              )}
            >
              {o === 0 ? "Any" : format(o)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-neutral-800">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
      {children}
    </label>
  );
}

const selectClass =
  "h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-base text-neutral-900 hover:border-neutral-400 focus-visible:border-accent";

/** All filter controls, grouped into sections so chips, the More panel and the mobile sheet share them. */
export function FilterFields({ draft, onChange, sections }: Props) {
  const id = useId();
  const has = (s: FilterSection) => sections.includes(s);
  const prices = draft.type === "rent" ? RENT_PRICES : SALE_PRICES;
  const closedStatus = draft.type === "rent" ? "leased" : "sold";
  const toggleIn = <T,>(list: T[] | undefined, v: T, on: boolean) => {
    const next = new Set(list ?? []);
    if (on) next.add(v);
    else next.delete(v);
    return [...next];
  };

  return (
    <div className="grid gap-6">
      {has("type") && (
        <fieldset>
          <legend className={fieldLabel}>Looking to</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["sale", "rent"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={draft.type === t}
                onClick={() =>
                  onChange({ type: t, status: ["active"], priceMin: undefined, priceMax: undefined, pets: undefined, furnished: undefined, availableBy: undefined })
                }
                className={cn(
                  "min-h-11 rounded-md border text-body font-medium",
                  draft.type === t ? "border-accent bg-accent/10 text-accent" : "border-neutral-300 text-neutral-800",
                )}
              >
                {t === "sale" ? "Buy" : "Rent"}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {has("price") && (
        <fieldset>
          <legend className={fieldLabel}>{draft.type === "rent" ? "Monthly rent" : "Price"}</legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${id}-pmin`} className="mb-1 block text-small text-neutral-600">Minimum</label>
              <select
                id={`${id}-pmin`}
                className={selectClass}
                value={draft.priceMin ?? ""}
                onChange={(e) => onChange({ priceMin: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">No min</option>
                {prices.map((p) => (
                  <option key={p} value={p}>{formatPrice(p, { compact: true })}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-pmax`} className="mb-1 block text-small text-neutral-600">Maximum</label>
              <select
                id={`${id}-pmax`}
                className={selectClass}
                value={draft.priceMax ?? ""}
                onChange={(e) => onChange({ priceMax: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">No max</option>
                {prices.map((p) => (
                  <option key={p} value={p}>{formatPrice(p, { compact: true })}</option>
                ))}
              </select>
            </div>
          </div>
          {draft.priceMin !== undefined && draft.priceMax !== undefined && draft.priceMin > draft.priceMax && (
            <p role="alert" className="mt-2 text-small text-danger">The minimum is higher than the maximum.</p>
          )}
        </fieldset>
      )}

      {has("beds") && (
        <Segmented label="Bedrooms" value={draft.bedsMin} options={BED_OPTIONS} format={(v) => `${v}+`} onChange={(v) => onChange({ bedsMin: v })} />
      )}
      {has("baths") && (
        <Segmented label="Bathrooms" value={draft.bathsMin} options={BATH_OPTIONS} format={(v) => `${v}+`} onChange={(v) => onChange({ bathsMin: v })} />
      )}

      {has("homeType") && (
        <fieldset>
          <legend className={fieldLabel}>Home type</legend>
          <div className="grid grid-cols-2 gap-x-4">
            {HOME_TYPES.map((t) => (
              <Check
                key={t.value}
                checked={draft.propertyTypes?.includes(t.value) ?? false}
                onChange={(on) => {
                  const next = toggleIn(draft.propertyTypes, t.value, on);
                  onChange({ propertyTypes: next.length ? next : undefined });
                }}
              >
                {t.label}
              </Check>
            ))}
          </div>
        </fieldset>
      )}

      {has("status") && (
        <fieldset>
          <legend className={fieldLabel}>Listing status</legend>
          <div className="grid gap-x-4 sm:grid-cols-3">
            {(["active", "pending", closedStatus] as const).map((s) => (
              <Check
                key={s}
                checked={draft.status.includes(s)}
                onChange={(on) => {
                  const next = toggleIn(draft.status, s, on);
                  onChange({ status: next.length ? next : ["active"] });
                }}
              >
                {s === "active" ? (draft.type === "rent" ? "For rent" : "For sale") : s === "pending" ? "Pending" : s === "sold" ? "Sold in the last 2 years" : "Leased in the last 2 years"}
              </Check>
            ))}
          </div>
        </fieldset>
      )}

      {has("size") && (
        <fieldset>
          <legend className={fieldLabel}>Size ({areaUnitLabel})</legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${id}-smin`} className="mb-1 block text-small text-neutral-600">Minimum</label>
              <Input
                id={`${id}-smin`}
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.sqftMin !== undefined ? fromSqft(draft.sqftMin) : ""}
                onChange={(e) => onChange({ sqftMin: e.target.value ? toSqft(Number(e.target.value)) : undefined })}
              />
            </div>
            <div>
              <label htmlFor={`${id}-smax`} className="mb-1 block text-small text-neutral-600">Maximum</label>
              <Input
                id={`${id}-smax`}
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.sqftMax !== undefined ? fromSqft(draft.sqftMax) : ""}
                onChange={(e) => onChange({ sqftMax: e.target.value ? toSqft(Number(e.target.value)) : undefined })}
              />
            </div>
          </div>
        </fieldset>
      )}

      {has("more") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-year`} className={fieldLabel}>Built in or after</label>
            <Input
              id={`${id}-year`}
              type="number"
              inputMode="numeric"
              min={1800}
              max={2100}
              placeholder="Any year"
              value={draft.yearBuiltMin ?? ""}
              onChange={(e) => onChange({ yearBuiltMin: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div>
            <label htmlFor={`${id}-dom`} className={fieldLabel}>Days listed</label>
            <select
              id={`${id}-dom`}
              className={selectClass}
              value={draft.daysOnMarketMax ?? ""}
              onChange={(e) => onChange({ daysOnMarketMax: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">Any time</option>
              {DAYS_ON_MARKET.map((d) => (
                <option key={d} value={d}>{d === 1 ? "Listed today" : `Within ${d} days`}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-kw`} className={fieldLabel}>Keywords</label>
            <Input
              id={`${id}-kw`}
              placeholder="Fireplace, balcony, garage"
              value={draft.keywords ?? ""}
              onChange={(e) => onChange({ keywords: e.target.value || undefined })}
            />
          </div>
        </div>
      )}

      {has("rental") && draft.type === "rent" && (
        <fieldset>
          <legend className={fieldLabel}>Rental details</legend>
          <Check checked={draft.pets === true} onChange={(on) => onChange({ pets: on ? true : undefined })}>
            Pets allowed
          </Check>
          <Check checked={draft.furnished === true} onChange={(on) => onChange({ furnished: on ? true : undefined })}>
            Furnished
          </Check>
          <label htmlFor={`${id}-avail`} className="mb-1 mt-3 block text-small text-neutral-600">Available by</label>
          <Input
            id={`${id}-avail`}
            type="date"
            value={draft.availableBy ?? ""}
            onChange={(e) => onChange({ availableBy: e.target.value || undefined })}
          />
        </fieldset>
      )}
    </div>
  );
}
