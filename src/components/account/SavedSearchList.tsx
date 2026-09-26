"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDate, formatPrice, propertyTypeLabel } from "@/lib/format";
import { ALERT_FREQUENCIES, ALERT_LABELS, type AlertFrequency } from "@/lib/saved-search-constants";
import { toQueryString } from "@/lib/search/url";
import type { SearchParams } from "@/types/search";

type Row = { id: string; name: string; filters: SearchParams; alertFrequency: AlertFrequency; lastAlertAt: string | null; createdAt: string };
const KEY = ["saved-searches"];

async function fetchRows(): Promise<Row[]> {
  const res = await fetch("/api/saved-searches");
  if (!res.ok) throw new Error("load failed");
  return ((await res.json()) as { data: Row[] }).data;
}

export function describeFilters(f: SearchParams): string {
  const parts: string[] = [f.type === "rent" ? "For rent" : "For sale"];
  if (f.city) parts.push(f.city.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
  if (f.bounds || f.polygon) parts.push("map area");
  if (f.priceMin || f.priceMax) {
    const fmt = (n: number) => formatPrice(n, { compact: true });
    parts.push(f.priceMin && f.priceMax ? `${fmt(f.priceMin)} to ${fmt(f.priceMax)}` : f.priceMin ? `${fmt(f.priceMin)}+` : `up to ${fmt(f.priceMax!)}`);
  }
  if (f.bedsMin) parts.push(`${f.bedsMin}+ beds`);
  if (f.bathsMin) parts.push(`${f.bathsMin}+ baths`);
  if (f.propertyTypes?.length) parts.push(f.propertyTypes.map(propertyTypeLabel).join(" or "));
  if (f.keywords) parts.push(`"${f.keywords}"`);
  return parts.join(", ");
}

export function SavedSearchList({ initial }: { initial: Row[] }) {
  const qc = useQueryClient();
  const { data = initial } = useQuery({ queryKey: KEY, queryFn: fetchRows, initialData: initial });
  const [status, setStatus] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);

  const patch = useMutation({
    mutationFn: async ({ id, alertFrequency }: { id: string; alertFrequency: AlertFrequency }) => {
      const res = await fetch(`/api/saved-searches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertFrequency }),
      });
      if (!res.ok) throw new Error("update failed");
    },
    onMutate: ({ id, alertFrequency }) => qc.setQueryData<Row[]>(KEY, (rows = []) => rows.map((r) => (r.id === id ? { ...r, alertFrequency } : r))),
    onSuccess: () => setStatus("Alert frequency updated."),
    onError: () => setStatus("We could not update that search. Try again."),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
    },
    onSuccess: (_d, id) => {
      qc.setQueryData<Row[]>(KEY, (rows = []) => rows.filter((r) => r.id !== id));
      setStatus("Saved search deleted.");
    },
    onError: () => setStatus("We could not delete that search. Try again."),
  });

  return (
    <div>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {status && (
        <p className="mb-4 rounded-md bg-neutral-50 px-3 py-2 text-small text-neutral-800" aria-hidden>
          {status}
        </p>
      )}
      {!data.length ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-6 py-12 text-center">
          <h2 className="text-h3">No saved searches yet</h2>
          <p className="mt-1 text-body text-neutral-600">Save a search to get an email when new homes match.</p>
          <Button asChild className="mt-5">
            <Link href="/search">Start a search</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="saved-searches">
          {data.map((row) => (
            <li key={row.id} data-testid="saved-search" className="flex flex-wrap items-center gap-4 rounded-lg border border-neutral-200 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/search?${toQueryString(row.filters)}`} className="text-h3 hover:underline">
                  {row.name}
                </Link>
                <p className="text-small text-neutral-600">{describeFilters(row.filters)}</p>
                <p className="text-small text-neutral-500">Saved {formatDate(row.createdAt)}</p>
              </div>
              <label className="flex items-center gap-2 text-small text-neutral-700">
                Alerts
                <select
                  value={row.alertFrequency}
                  onChange={(e) => patch.mutate({ id: row.id, alertFrequency: e.target.value as AlertFrequency })}
                  className="h-11 rounded-md border border-neutral-300 bg-white px-3 text-base text-neutral-900"
                  aria-label={`Email alerts for ${row.name}`}
                >
                  {ALERT_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {ALERT_LABELS[f]}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="ghost" size="icon" aria-label={`Delete ${row.name}`} onClick={() => setConfirm(row)}>
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog.Root open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-raised">
            <Dialog.Title className="text-h3">Delete this saved search?</Dialog.Title>
            <Dialog.Description className="mt-1 text-body text-neutral-600">
              You will stop getting alerts for {confirm?.name}.
            </Dialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="ghost">Keep it</Button>
              </Dialog.Close>
              <Button
                className="bg-danger hover:bg-danger/90"
                onClick={() => {
                  if (confirm) remove.mutate(confirm.id);
                  setConfirm(null);
                }}
              >
                Delete
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
