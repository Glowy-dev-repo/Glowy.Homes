"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { track } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";

type SavedState = {
  isSaved: (id: string) => boolean;
  toggle: (id: string) => Promise<void>;
  ready: boolean;
};

const SavedContext = createContext<SavedState>({ isSaved: () => false, toggle: async () => {}, ready: false });
const KEY = ["saved-home-ids"];
const INTENT_PARAM = "save";

async function fetchIds(): Promise<string[]> {
  const res = await fetch("/api/saved-homes?ids=1");
  if (!res.ok) return [];
  return ((await res.json()) as { data: string[] }).data;
}

async function setSaved(listingId: string, saved: boolean) {
  const res = await fetch("/api/saved-homes", {
    method: saved ? "POST" : "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listingId }),
  });
  if (!res.ok) throw new Error("Could not update saved homes");
  if (saved) track("save_home", { listingId });
}

/**
 * Saved homes for the signed in user (docs/05 Phase 2 task 6): optimistic toggles, and a
 * signed out save resumes after sign in via ?save=<id> on the return URL.
 */
export function SavedHomesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const qc = useQueryClient();
  const authed = status === "authenticated";
  const { data: ids, isSuccess } = useQuery({ queryKey: KEY, queryFn: fetchIds, enabled: authed, staleTime: 5 * 60_000 });
  const set = useMemo(() => new Set(ids ?? []), [ids]);
  const resumed = useRef(false);

  const toggle = useCallback(
    async (id: string) => {
      const next = !set.has(id);
      qc.setQueryData<string[]>(KEY, (old = []) => (next ? [...old, id] : old.filter((x) => x !== id)));
      try {
        await setSaved(id, next);
      } catch {
        qc.setQueryData<string[]>(KEY, (old = []) => (next ? old.filter((x) => x !== id) : [...old, id]));
      } finally {
        qc.invalidateQueries({ queryKey: ["saved-homes"] });
      }
    },
    [qc, set],
  );

  // Resume a save that started before sign in.
  useEffect(() => {
    if (!authed || !isSuccess || resumed.current) return;
    const url = new URL(window.location.href);
    const pending = url.searchParams.get(INTENT_PARAM);
    if (!pending) return;
    resumed.current = true;
    url.searchParams.delete(INTENT_PARAM);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    if (!set.has(pending)) void toggle(pending);
  }, [authed, isSuccess, set, toggle]);

  const value = useMemo(() => ({ isSaved: (id: string) => set.has(id), toggle, ready: !authed || isSuccess }), [set, toggle, authed, isSuccess]);
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export const useSavedHomes = () => useContext(SavedContext);

export function SaveButton({ listingId, variant = "overlay", label }: { listingId: string; variant?: "overlay" | "button"; label?: string }) {
  const { status } = useSession();
  const { isSaved, toggle } = useSavedHomes();
  const router = useRouter();
  const pathname = usePathname();
  const saved = isSaved(listingId);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status !== "authenticated") {
      const back = new URL(window.location.href);
      back.searchParams.set(INTENT_PARAM, listingId);
      router.push(`/signin?callbackUrl=${encodeURIComponent(`${pathname}${back.search}`)}`);
      return;
    }
    void toggle(listingId);
  };

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        data-testid="save-button"
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 text-body font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
      >
        <Heart className={cn("size-5", saved ? "fill-danger text-danger" : "text-neutral-700")} aria-hidden />
        {label ?? (saved ? "Saved" : "Save")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved homes" : "Save home"}
      data-testid="save-button"
      className="grid size-11 place-items-center rounded-full transition-transform duration-150 hover:scale-105"
    >
      <span className="grid size-9 place-items-center rounded-full bg-white/95 shadow-card">
        <Heart className={cn("size-5", saved ? "fill-danger text-danger" : "text-neutral-800")} aria-hidden />
      </span>
    </button>
  );
}
