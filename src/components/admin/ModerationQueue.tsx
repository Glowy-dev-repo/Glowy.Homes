"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { ModerationRow } from "@/server/data/admin";

/** docs/04 ModerationQueueRow: approve, or reject with an inline reason. */
function Row({ item }: { item: ModerationRow }) {
  const router = useRouter();
  const id = useId();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const decide = async (decision: "approve" | "reject") => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/moderation", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, decision, note: note || undefined }) });
    setBusy(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { error?: { message: string; fields?: Record<string, string[]> } } | null;
      setError(b?.error?.fields?.note?.[0] ?? b?.error?.message ?? "That did not work.");
      return;
    }
    router.refresh();
  };

  return (
    <li className="rounded-lg border border-neutral-200 p-4" data-testid="moderation-item" data-item-type={item.itemType}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-small font-semibold uppercase text-neutral-600">
            {item.itemType} · {item.reason.replace(/_/g, " ")}
            {item.priority === "high" && <span className="ml-2 rounded-pill bg-danger/10 px-2 py-0.5 text-danger">High priority</span>}
          </p>
          <p className="text-h3">{item.title}</p>
          {item.detail && <p className="mt-1 text-body text-neutral-700">{item.detail}</p>}
          {item.failedChecks.length > 0 && <p className="mt-1 text-small text-danger">Failed checks: {item.failedChecks.join(", ")}</p>}
          <p className="text-small text-neutral-500">Waiting since {formatDate(item.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => decide("approve")} disabled={busy}>Approve</Button>
          <Button variant="secondary" onClick={() => setRejecting((r) => !r)} disabled={busy} aria-expanded={rejecting}>Reject</Button>
        </div>
      </div>
      {rejecting && (
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void decide("reject"); }}>
          <label htmlFor={`${id}-note`} className="sr-only">Reason for rejection</label>
          <input id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason, sent to the submitter" className="h-11 min-w-64 flex-1 rounded-md border border-neutral-300 px-3 text-base" />
          <Button type="submit" className="bg-danger hover:bg-danger/90" disabled={busy}>Confirm rejection</Button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-small text-danger">{error}</p>}
    </li>
  );
}

export function ModerationQueue({ items }: { items: ModerationRow[] }) {
  if (!items.length) return <p className="text-body text-neutral-600">Nothing waiting for review.</p>;
  return <ul className="space-y-3" data-testid="moderation-queue">{items.map((i) => <Row key={i.id} item={i} />)}</ul>;
}
