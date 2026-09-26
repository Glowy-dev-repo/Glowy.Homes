"use client";

import { Loader2, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ListingCard } from "@/components/listing/ListingCard";
import { SaveButton } from "@/components/listing/saved-homes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ShareRow, SharedHome } from "@/server/data/shares";

/** docs/05 Phase 6 task 4: invite by email, see who you share with, and the combined list. */
export function SharedList({ shares, homes }: { shares: ShareRow[]; homes: SharedHome[] }) {
  const router = useRouter();
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    setError(null);
    const res = await fetch("/api/shares", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { error?: { message: string; fields?: Record<string, string[]> } } | null;
      setError(b?.error?.fields?.email?.[0] ?? b?.error?.message ?? "We could not send the invitation.");
      setState("idle");
      return;
    }
    setState("sent");
    setEmail("");
    router.refresh();
  };
  const remove = async (shareId: string) => {
    await fetch(`/api/shares/${shareId}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby={`${id}-people`} className="max-w-2xl">
        <h2 id={`${id}-people`} className="mb-3 text-h3">People</h2>
        {shares.length > 0 && (
          <ul className="mb-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200" data-testid="share-people">
            {shares.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name ?? s.email}</p>
                  <p className="text-small text-neutral-600">{s.accepted ? (s.direction === "sent" ? "Sharing" : "Shared with you") : "Invitation sent"}</p>
                </div>
                <Button variant="ghost" onClick={() => remove(s.id)} aria-label={`${s.accepted ? "Stop sharing with" : "Cancel invitation to"} ${s.name ?? s.email}`}>
                  <X aria-hidden />
                  {s.accepted ? "Stop sharing" : "Cancel"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={invite} className="flex flex-wrap items-start gap-2" noValidate>
          <div className="grid min-w-0 flex-1 gap-1">
            <label htmlFor={`${id}-email`} className="text-small font-medium text-neutral-800">Invite by email</label>
            <Input id={`${id}-email`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="partner@example.com" aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-err` : undefined} />
            {error && <p id={`${id}-err`} role="alert" className="text-small text-danger">{error}</p>}
            {state === "sent" && <p role="status" className="text-small text-success">Invitation sent.</p>}
          </div>
          <Button type="submit" className="mt-6" disabled={state === "busy" || !email}>
            {state === "busy" ? <Loader2 className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />}Send invite
          </Button>
        </form>
      </section>

      <section aria-labelledby={`${id}-homes`}>
        <h2 id={`${id}-homes`} className="mb-3 text-h3">Homes ({homes.length})</h2>
        {homes.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="shared-homes">
            {homes.map((h) => (
              <li key={h.id} data-testid="shared-home">
                <ListingCard listing={h} action={<SaveButton listingId={h.id} />} />
                <p className="mt-1 text-small text-neutral-600">Saved by {h.savedBy.join(" and ")}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-neutral-600">Nobody has saved a home yet. Tap the heart on any home to add it.</p>
        )}
      </section>
    </div>
  );
}
