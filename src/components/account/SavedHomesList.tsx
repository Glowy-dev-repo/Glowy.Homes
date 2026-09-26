"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ListingCard } from "@/components/listing/ListingCard";
import { SaveButton } from "@/components/listing/saved-homes";
import { Button } from "@/components/ui/button";
import type { ListingSummary } from "@/types/search";

type Saved = ListingSummary & { savedAt: string; note: string | null };

async function fetchSaved(): Promise<Saved[]> {
  const res = await fetch("/api/saved-homes");
  if (!res.ok) throw new Error("Could not load saved homes");
  return ((await res.json()) as { data: Saved[] }).data;
}

/** Saved homes list; unsaving a card removes it here too (SaveButton invalidates this query). */
export function SavedHomesList({ initial }: { initial: Saved[] }) {
  const { data = initial, isError } = useQuery({ queryKey: ["saved-homes"], queryFn: fetchSaved, initialData: initial });

  if (isError) return <p role="alert" className="text-body text-danger">We could not load your saved homes. Refresh to try again.</p>;
  if (!data.length) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-6 py-12 text-center">
        <h2 className="text-h3">No saved homes yet</h2>
        <p className="mt-1 text-body text-neutral-600">Tap the heart on any home to keep it here.</p>
        <Button asChild className="mt-5">
          <Link href="/search">Search homes</Link>
        </Button>
      </div>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="saved-homes">
      {data.map((home) => (
        <li key={home.id}>
          <ListingCard listing={home} action={<SaveButton listingId={home.id} />} />
        </li>
      ))}
    </ul>
  );
}
