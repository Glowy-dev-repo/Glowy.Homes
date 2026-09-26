"use client";

import { Search } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = { id: "buy" | "rent" | "value"; label: string; action: string; name: string; hidden?: Record<string, string>; placeholder: string };

const TABS: Tab[] = [
  { id: "buy", label: "Buy", action: "/search", name: "q", hidden: { type: "sale" }, placeholder: "City, neighbourhood, address or postal code" },
  { id: "rent", label: "Rent", action: "/search", name: "q", hidden: { type: "rent" }, placeholder: "City, neighbourhood, address or postal code" },
  { id: "value", label: "Home value", action: "/home-value", name: "address", placeholder: "Enter your home address" },
];

/**
 * Hero search shell: three tabs above one large input (docs/04 Home template).
 * Autocomplete arrives with the SearchBar in Phase 1; until then it submits a plain GET.
 */
export function HeroSearch() {
  const [active, setActive] = useState<Tab["id"]>("buy");
  const tab = TABS.find((t) => t.id === active)!;
  const baseId = useId();

  return (
    <div className="w-full max-w-2xl">
      <div role="tablist" aria-label="Search type" className="mb-3 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`${baseId}-${t.id}`}
            role="tab"
            type="button"
            aria-selected={t.id === active}
            aria-controls={`${baseId}-panel`}
            onClick={() => setActive(t.id)}
            className={cn(
              "min-h-11 rounded-pill px-4 text-body font-medium transition-colors duration-150",
              t.id === active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <form
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-${tab.id}`}
        action={tab.action}
        method="get"
        className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white p-2 shadow-raised focus-within:border-accent"
      >
        {Object.entries(tab.hidden ?? {}).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <label htmlFor={`${baseId}-input`} className="sr-only">
          {tab.placeholder}
        </label>
        <Search className="ml-2 size-5 shrink-0 text-neutral-500" aria-hidden />
        <input
          id={`${baseId}-input`}
          name={tab.name}
          type="search"
          autoComplete={tab.id === "value" ? "street-address" : "off"}
          placeholder={tab.placeholder}
          className="h-12 min-w-0 flex-1 bg-transparent text-base text-neutral-900 placeholder:text-neutral-500 focus:outline-none"
        />
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>
    </div>
  );
}
