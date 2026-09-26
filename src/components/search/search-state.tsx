"use client";

import { useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { parseSearchParams, toQueryString } from "@/lib/search/url";
import type { SearchParams, SearchParamsInput } from "@/types/search";

/**
 * The URL is the single source of truth for search state. Updates go through the History API,
 * which Next's router observes, so filters survive reload and back works without a server
 * round trip.
 */
export function useSearchState() {
  const searchParams = useSearchParams();
  const params = useMemo(() => parseSearchParams(searchParams), [searchParams]);

  const setParams = useCallback(
    (next: SearchParamsInput | ((p: SearchParams) => SearchParamsInput), opts: { replace?: boolean } = {}) => {
      const current = parseSearchParams(new URLSearchParams(window.location.search));
      const value = typeof next === "function" ? next(current) : next;
      const qs = toQueryString(value);
      const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
      if (opts.replace) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
    },
    [],
  );

  /** Merge a filter change and reset to page 1. */
  const update = useCallback(
    (patch: Partial<SearchParamsInput>, opts: { replace?: boolean } = {}) =>
      setParams((p) => ({ ...p, ...patch, page: patch.page ?? 1 }), opts),
    [setParams],
  );

  return { params, setParams, update };
}

type HoverState = { hoveredId: string | null; setHoveredId: (id: string | null) => void };
const HoverContext = createContext<HoverState>({ hoveredId: null, setHoveredId: () => {} });

/** Shared hover between list and map (docs/04 MapView): hovering either highlights the other. */
export function HoverProvider({ children }: { children: React.ReactNode }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const value = useMemo(() => ({ hoveredId, setHoveredId }), [hoveredId]);
  return <HoverContext.Provider value={value}>{children}</HoverContext.Provider>;
}

export const useHover = () => useContext(HoverContext);
