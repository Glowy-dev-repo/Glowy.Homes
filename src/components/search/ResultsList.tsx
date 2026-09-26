"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { ListingCard, ListingCardSkeleton } from "@/components/listing/ListingCard";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PAGE_SIZE, SORTS, type SearchParams, type SearchResult } from "@/types/search";
import { SORT_LABELS } from "./filter-options";
import { useHover } from "./search-state";

export function ResultsList({
  title,
  params,
  result,
  loading,
  onSort,
  onPage,
  onClearFilters,
  saveSearchSlot,
}: {
  title: string;
  params: SearchParams;
  result: SearchResult | undefined;
  loading: boolean;
  onSort: (sort: SearchParams["sort"]) => void;
  onPage: (page: number) => void;
  onClearFilters: () => void;
  saveSearchSlot?: React.ReactNode;
}) {
  const { hoveredId, setHoveredId } = useHover();
  const total = result?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const noun = params.type === "rent" ? (total === 1 ? "rental" : "rentals") : total === 1 ? "home" : "homes";

  return (
    <section aria-labelledby="results-heading" className="px-4 py-4 lg:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="results-heading" className="text-h2">
            {title}
          </h1>
          <p className="text-small text-neutral-600" aria-live="polite" data-testid="result-count">
            {result ? `${formatNumber(total)} ${noun}` : "Searching"}
          </p>
        </div>
        <label className="flex items-center gap-2 text-small text-neutral-700">
          Sort
          <select
            value={params.sort}
            onChange={(e) => onSort(e.target.value as SearchParams["sort"])}
            className="h-11 rounded-md border border-neutral-300 bg-white px-3 text-base text-neutral-900"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!result && loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 8 }, (_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-6 py-12 text-center">
          <h2 className="text-h3">No homes match</h2>
          <p className="mt-1 text-body text-neutral-600">Try widening the area or removing a filter.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={onClearFilters}>
              Clear filters
            </Button>
            {saveSearchSlot}
          </div>
        </div>
      ) : (
        <>
          <ul className={cn("grid gap-4 transition-opacity sm:grid-cols-2", loading && "opacity-60")} aria-busy={loading}>
            {result!.items.map((item, i) => (
              <li key={item.id}>
                <ListingCard listing={item} highlighted={hoveredId === item.id} onHoverChange={setHoveredId} priority={i < 2} />
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
              <Button variant="secondary" size="icon" aria-label="Previous page" disabled={params.page <= 1} onClick={() => onPage(params.page - 1)}>
                <ChevronLeft aria-hidden />
              </Button>
              <span className="px-3 text-body text-neutral-700">
                Page {params.page} of {formatNumber(pages)}
              </span>
              <Button variant="secondary" size="icon" aria-label="Next page" disabled={params.page >= pages} onClick={() => onPage(params.page + 1)}>
                <ChevronRight aria-hidden />
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
