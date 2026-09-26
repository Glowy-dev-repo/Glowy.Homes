"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ListingCard } from "@/components/listing/ListingCard";
import { searchTitle } from "@/lib/search/title";
import { toQueryString } from "@/lib/search/url";
import type { SearchResult } from "@/types/search";
import { FilterBar, clearedFilters } from "./FilterBar";
import type { Bounds } from "./MapView";
import { ResultsList } from "./ResultsList";
import { SaveSearchButton } from "./SaveSearchButton";
import { SearchBar } from "./SearchBar";
import { HoverProvider, useHover, useSearchState } from "./search-state";

// MapLibre is large; it loads after the list and only where the map is visible.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-neutral-100" aria-hidden />,
});

function useIsDesktop(): boolean | null {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => null,
  );
}

async function fetchSearch(qs: string): Promise<SearchResult> {
  const res = await fetch(`/api/search?${qs}`);
  const body = (await res.json()) as { data: SearchResult | null; error: { message: string } | null };
  if (!res.ok || !body.data) throw new Error(body.error?.message ?? "Search failed");
  return body.data;
}

function SearchAppInner({
  initialKey,
  initialResult,
  placeName,
  regionBbox,
}: {
  initialKey: string;
  initialResult: SearchResult;
  placeName: string | null;
  regionBbox: Bounds | null;
}) {
  const { params, setParams, update } = useSearchState();
  const { hoveredId, setHoveredId } = useHover();
  const isDesktop = useIsDesktop();
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [searchAsMove, setSearchAsMove] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const key = toQueryString(params);

  const query = useQuery({
    queryKey: ["search", key],
    queryFn: () => fetchSearch(key),
    initialData: key === initialKey ? initialResult : undefined,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const result = query.data;

  useEffect(() => setSelectedId(null), [key]);

  const selected = useMemo(() => result?.items.find((i) => i.id === selectedId) ?? null, [result, selectedId]);
  const title = searchTitle(params, params.bounds || params.polygon ? null : placeName);
  const showMap = isDesktop === true || (isDesktop === false && mobileView === "map");
  const initialBounds = (params.bounds as Bounds | undefined) ?? regionBbox;

  return (
    <div className="flex flex-col">
      <div className="border-b border-neutral-200 bg-white px-4 pt-3 lg:px-6">
        <div className="max-w-xl pb-1">
          <SearchBar
            listingType={params.type}
            defaultValue={params.q ?? ""}
            onSubmitText={(text) => update({ q: text || undefined, city: undefined, neighborhood: undefined, bounds: undefined, polygon: undefined })}
          />
        </div>
      </div>
      <FilterBar
        params={params}
        onApply={(next) => setParams({ ...next, page: 1 })}
        mobileView={mobileView}
        onMobileViewChange={setMobileView}
        saveSearchSlot={<SaveSearchButton params={params} defaultName={title} />}
      />
      <div className="lg:grid lg:grid-cols-[55fr_45fr]">
        <div className={mobileView === "map" && isDesktop === false ? "hidden" : ""}>
          <ResultsList
            title={title}
            params={params}
            result={result}
            loading={query.isFetching}
            onSort={(sort) => update({ sort })}
            onPage={(page) => {
              update({ page });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onClearFilters={() => setParams({ ...params, ...clearedFilters(params), page: 1 })}
            saveSearchSlot={
              <SaveSearchButton params={params} defaultName={title} variant="primary" label="Save this search to get alerts" resumeIntent={false} />
            }
          />
        </div>
        {showMap && (
          <div className="relative h-[calc(100dvh-124px)] lg:sticky lg:top-[124px]">
            {/* Sticky under the header (64px) and the sticky filter bar (60px). */}
            <MapView
              pins={result?.pins ?? []}
              clusters={result?.clusters ?? []}
              initialBounds={initialBounds}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              onSelect={setSelectedId}
              searchAsMove={searchAsMove}
              onSearchAsMoveChange={setSearchAsMove}
              onBoundsChange={(bounds) =>
                // Moving the map replaces the place filter with the visible area.
                update({ bounds, city: undefined, neighborhood: undefined, q: undefined, polygon: undefined }, { replace: true })
              }
            />
            {selected && (
              <div className="absolute inset-x-3 bottom-3 z-10 max-w-sm">
                <ListingCard listing={selected} size="compact" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SearchApp(props: {
  initialKey: string;
  initialResult: SearchResult;
  placeName: string | null;
  regionBbox: Bounds | null;
}) {
  return (
    <HoverProvider>
      <SearchAppInner {...props} />
    </HoverProvider>
  );
}
