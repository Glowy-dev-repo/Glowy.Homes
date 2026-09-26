"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, List, Map as MapIcon, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatNumber, formatPrice } from "@/lib/format";
import { activeFilterCount, toQueryString } from "@/lib/search/url";
import { cn } from "@/lib/utils";
import type { SearchParams } from "@/types/search";
import { FilterFields, type FilterSection } from "./FilterFields";
import { HOME_TYPES } from "./filter-options";

function priceLabel(p: SearchParams): string | null {
  const fmt = (n: number) => formatPrice(n, { compact: true });
  if (p.priceMin !== undefined && p.priceMax !== undefined) return `${fmt(p.priceMin)} to ${fmt(p.priceMax)}`;
  if (p.priceMin !== undefined) return `${fmt(p.priceMin)}+`;
  if (p.priceMax !== undefined) return `Up to ${fmt(p.priceMax)}`;
  return null;
}

function homeTypeLabel(p: SearchParams): string | null {
  if (!p.propertyTypes?.length) return null;
  if (p.propertyTypes.length === 1) return HOME_TYPES.find((t) => t.value === p.propertyTypes![0])?.label ?? null;
  return `${p.propertyTypes.length} home types`;
}

function moreCount(p: SearchParams): number {
  const keys = ["sqftMin", "sqftMax", "yearBuiltMin", "daysOnMarketMax", "keywords", "pets", "furnished", "laundry", "parking", "availableBy"] as const;
  return keys.filter((k) => p[k] !== undefined).length + (p.status.join(",") !== "active" ? 1 : 0);
}

/** A filter chip whose popover edits a draft and applies it. */
function Chip({
  label,
  activeLabel,
  sections,
  params,
  onApply,
  wide,
}: {
  label: string;
  activeLabel: string | null;
  sections: FilterSection[];
  params: SearchParams;
  onApply: (next: SearchParams) => void;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(params);
  useEffect(() => {
    if (open) setDraft(params);
  }, [open, params]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-pill border px-4 text-body font-medium transition-colors duration-150",
            activeLabel ? "border-accent bg-accent/10 text-accent" : "border-neutral-300 text-neutral-800 hover:border-neutral-400",
          )}
        >
          {activeLabel ?? label}
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          aria-label={`${label} filter`}
          className={cn("z-50 rounded-lg border border-neutral-200 bg-white p-5 shadow-raised", wide ? "w-[560px]" : "w-[360px]")}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onApply(draft);
              setOpen(false);
            }}
          >
            <FilterFields draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} sections={sections} />
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Full screen mobile sheet with every filter and a live "Show N homes" button (docs/04 FilterBar). */
function MobileFilters({ params, onApply }: { params: SearchParams; onApply: (next: SearchParams) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(params);
  const [count, setCount] = useState<number | null>(null);
  const n = activeFilterCount(params);

  useEffect(() => {
    if (open) setDraft(params);
  }, [open, params]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?${toQueryString({ ...draft, page: 1 })}`, { signal: controller.signal });
        const body = (await res.json()) as { data: { total: number } | null };
        setCount(body.data?.total ?? null);
      } catch {
        // aborted
      }
    }, 250);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [draft, open]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="secondary" className="rounded-pill">
          <SlidersHorizontal aria-hidden />
          Filters
          {n > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-accent text-[12px] font-semibold text-white" aria-label={`${n} active`}>
              {n}
            </span>
          )}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col bg-white focus:outline-none">
          <div className="flex h-14 items-center justify-between border-b border-neutral-200 px-4">
            <Dialog.Title className="text-h3">Filters</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close filters">
                <X className="size-5!" aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Refine the homes shown</Dialog.Description>
          <div className="flex-1 overflow-y-auto px-4 py-5">
            <FilterFields
              draft={draft}
              onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              sections={["type", "price", "beds", "baths", "homeType", "status", "size", "more", "rental"]}
            />
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2 border-t border-neutral-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              variant="ghost"
              onClick={() => setDraft((d) => ({ ...d, ...clearedFilters(d) }))}
            >
              Clear all
            </Button>
            <Button
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              {count === null ? "Show homes" : `Show ${formatNumber(count)} ${count === 1 ? "home" : "homes"}`}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function clearedFilters(p: SearchParams): Partial<SearchParams> {
  return {
    status: ["active"],
    priceMin: undefined,
    priceMax: undefined,
    bedsMin: undefined,
    bathsMin: undefined,
    propertyTypes: undefined,
    sqftMin: undefined,
    sqftMax: undefined,
    yearBuiltMin: undefined,
    daysOnMarketMax: undefined,
    keywords: undefined,
    pets: undefined,
    furnished: undefined,
    laundry: undefined,
    parking: undefined,
    availableBy: undefined,
    type: p.type,
  };
}

export function FilterBar({
  params,
  onApply,
  mobileView,
  onMobileViewChange,
  saveSearchSlot,
}: {
  params: SearchParams;
  onApply: (next: SearchParams) => void;
  mobileView: "list" | "map";
  onMobileViewChange: (v: "list" | "map") => void;
  saveSearchSlot?: React.ReactNode;
}) {
  const more = moreCount(params);
  return (
    <div className="sticky top-16 z-20 border-b border-neutral-200 bg-white">
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 lg:px-6">
        {/* Desktop chips */}
        <div className="hidden items-center gap-2 lg:flex" role="group" aria-label="Filters">
          <div role="radiogroup" aria-label="Listing type" className="flex rounded-pill border border-neutral-300 p-0.5">
            {(["sale", "rent"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={params.type === t}
                onClick={() => params.type !== t && onApply({ ...params, ...clearedFilters(params), type: t, propertyTypes: params.propertyTypes, bedsMin: params.bedsMin, bathsMin: params.bathsMin })}
                className={cn(
                  "min-h-10 rounded-pill px-4 text-body font-medium transition-colors",
                  params.type === t ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100",
                )}
              >
                {t === "sale" ? "For sale" : "For rent"}
              </button>
            ))}
          </div>
          <Chip label="Price" activeLabel={priceLabel(params)} sections={["price"]} params={params} onApply={onApply} />
          <Chip label="Beds" activeLabel={params.bedsMin ? `${params.bedsMin}+ bd` : null} sections={["beds"]} params={params} onApply={onApply} />
          <Chip label="Baths" activeLabel={params.bathsMin ? `${params.bathsMin}+ ba` : null} sections={["baths"]} params={params} onApply={onApply} />
          <Chip label="Home type" activeLabel={homeTypeLabel(params)} sections={["homeType"]} params={params} onApply={onApply} />
          <Chip
            label="More"
            activeLabel={more ? `More (${more})` : null}
            sections={["status", "size", "more", "rental"]}
            params={params}
            onApply={onApply}
            wide
          />
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 lg:hidden">
          <MobileFilters params={params} onApply={onApply} />
          <Button
            variant="secondary"
            className="rounded-pill"
            onClick={() => onMobileViewChange(mobileView === "list" ? "map" : "list")}
            aria-label={mobileView === "list" ? "Show map" : "Show list"}
          >
            {mobileView === "list" ? <MapIcon aria-hidden /> : <List aria-hidden />}
            {mobileView === "list" ? "Map" : "List"}
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2">{saveSearchSlot}</div>
      </div>
    </div>
  );
}
