"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { SearchBar } from "./SearchBar";

type TabId = "buy" | "rent" | "value";

const TABS: { id: TabId; label: string; placeholder: string }[] = [
  { id: "buy", label: "Buy", placeholder: "City, neighbourhood, address or postal code" },
  { id: "rent", label: "Rent", placeholder: "City, neighbourhood, address or postal code" },
  { id: "value", label: "Home value", placeholder: "Enter your home address" },
];

/** Home hero: three tabs above one large SearchBar (docs/04 Home template). */
export function HeroSearch() {
  const router = useRouter();
  const [active, setActive] = useState<TabId>("buy");
  const tab = TABS.find((t) => t.id === active)!;
  const baseId = useId();

  const submitText = (text: string) => {
    if (active === "value") {
      router.push(`/home-value?${new URLSearchParams(text ? { address: text } : {})}`);
      return;
    }
    const qs = new URLSearchParams({ type: active === "rent" ? "rent" : "sale" });
    if (text) qs.set("q", text);
    router.push(`/search?${qs}`);
  };

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
      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-${tab.id}`}>
        <SearchBar
          key={tab.id}
          size="lg"
          listingType={active === "rent" ? "rent" : "sale"}
          placeholder={tab.placeholder}
          label={tab.placeholder}
          onSubmitText={submitText}
        />
      </div>
    </div>
  );
}
