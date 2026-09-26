"use client";

import { Loader2, MapPin, Search, Hash, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Suggestion } from "@/lib/search/autocomplete";
import { cn } from "@/lib/utils";

const GROUP_LABELS: Record<Suggestion["group"], string> = {
  places: "Places",
  addresses: "Addresses",
  listings: "Listing IDs",
};

const ICONS: Record<Suggestion["group"], typeof MapPin> = { places: MapPin, addresses: Home, listings: Hash };

/**
 * docs/04 SearchBar: one input with an autocomplete listbox grouped as Places, Addresses and
 * Listing IDs. Enter without a selection runs a text search via onSubmitText.
 */
export function SearchBar({
  listingType = "sale",
  placeholder = "City, neighborhood, address or listing ID",
  defaultValue = "",
  size = "md",
  label = "Search homes",
  onSubmitText,
}: {
  listingType?: "sale" | "rent";
  placeholder?: string;
  defaultValue?: string;
  size?: "md" | "lg";
  label?: string;
  onSubmitText: (text: string) => void;
}) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => setValue(defaultValue), [defaultValue]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    const handle = setTimeout(async () => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setLoading(true);
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}&type=${listingType}`, { signal: controller.signal });
        const body = (await res.json()) as { data: Suggestion[] | null };
        setItems(body.data ?? []);
        setActive(-1);
      } catch {
        // Aborted or offline: keep the previous suggestions.
      } finally {
        if (abort.current === controller) setLoading(false);
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [value, listingType]);

  const choose = (s: Suggestion) => {
    setOpen(false);
    router.push(s.href);
  };

  const submit = () => {
    if (open && active >= 0 && items[active]) return choose(items[active]);
    setOpen(false);
    onSubmitText(value.trim());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Escape" && showList) {
      // Close the list without the browser's default of clearing a search input.
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  const showList = open && items.length > 0;
  let lastGroup: Suggestion["group"] | null = null;

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="relative w-full"
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-neutral-300 bg-white transition-colors focus-within:border-accent",
          size === "lg" ? "p-2 shadow-raised" : "p-1 pl-2",
        )}
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          {label}
        </label>
        {loading ? (
          <Loader2 className="ml-1 size-5 shrink-0 animate-spin text-neutral-500" aria-hidden />
        ) : (
          <Search className="ml-1 size-5 shrink-0 text-neutral-500" aria-hidden />
        )}
        <input
          id={`${id}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-base text-neutral-900 placeholder:text-neutral-500 focus:outline-none",
            size === "lg" ? "h-12" : "h-10",
          )}
        />
        <Button type="submit" size={size === "lg" ? "lg" : "md"}>
          Search
        </Button>
      </div>

      <ul
        id={`${id}-list`}
        role="listbox"
        aria-label="Suggestions"
        hidden={!showList}
        className="absolute inset-x-0 top-full z-40 mt-1 max-h-96 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-raised"
      >
        {items.map((s, i) => {
          const Icon = ICONS[s.group];
          const header = s.group !== lastGroup ? GROUP_LABELS[s.group] : null;
          lastGroup = s.group;
          return (
            <li key={`${s.group}-${s.href}`} role="presentation">
              {header && (
                <div role="presentation" className="px-3 pb-1 pt-2 text-label uppercase text-neutral-500">
                  {header}
                </div>
              )}
              <div
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2", i === active && "bg-neutral-100")}
              >
                <Icon className="size-4 shrink-0 text-neutral-500" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-body text-neutral-900">{s.label}</span>
                  <span className="block truncate text-small text-neutral-600">{s.sublabel}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </form>
  );
}
