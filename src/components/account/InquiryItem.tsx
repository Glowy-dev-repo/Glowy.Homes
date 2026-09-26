"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Inquiry = { id: string; leadType: string; status: string; createdAt: string; address: string | null; listingId: string | null; proName: string | null; proSlug: string | null; brokerage: string | null; reviewed: boolean };
type Msg = { id: string; body: string; mine: boolean; senderName: string | null; createdAt: string };

const TYPE: Record<string, string> = { tour: "Tour request", contact: "Question", sell: "Selling", preapproval: "Preapproval", rental_inquiry: "Rental inquiry", rental_application: "Rental application" };
const STATUS: Record<string, string> = { new: "Sent", contacted: "In touch", qualified: "In touch", touring: "Touring", under_contract: "Under contract", closed: "Closed", lost: "Closed", unassigned: "Matching you with a professional" };

/** One inquiry: who has it, its status, the message thread, and a review once closed (docs/01 P6, P8). */
export function InquiryItem({ inquiry }: { inquiry: Inquiry }) {
  const qc = useQueryClient();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [reviewState, setReviewState] = useState<"idle" | "sent" | "error">(inquiry.reviewed ? "sent" : "idle");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const key = ["messages", inquiry.id];
  const thread = useQuery({
    queryKey: key,
    queryFn: async () => ((await (await fetch(`/api/leads/${inquiry.id}/messages`)).json()) as { data: Msg[] }).data,
    enabled: open,
  });
  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/leads/${inquiry.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: msg }) });
      if (!res.ok) throw new Error("send failed");
    },
    onSuccess: () => {
      setMsg("");
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError(null);
    const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: inquiry.id, rating, body: review || undefined }) });
    if (res.ok) setReviewState("sent");
    else {
      const b = (await res.json().catch(() => null)) as { error?: { message: string; fields?: Record<string, string[]> } } | null;
      setReviewError(b?.error?.fields?.rating?.[0] ?? b?.error?.message ?? "We could not send your review.");
      setReviewState("error");
    }
  };

  return (
    <li className="rounded-lg border border-neutral-200 p-5" data-testid="inquiry">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-h3">{TYPE[inquiry.leadType] ?? "Inquiry"}{inquiry.address ? `: ${inquiry.address}` : ""}</p>
          <p className="text-small text-neutral-600">Sent {formatDate(inquiry.createdAt)} · {STATUS[inquiry.status] ?? inquiry.status}</p>
          {inquiry.proName ? (
            <p className="mt-1 text-body" data-testid="inquiry-pro">
              With{" "}
              {inquiry.proSlug ? <Link href={`/agent/${inquiry.proSlug}`} className="font-medium text-accent hover:underline">{inquiry.proName}</Link> : inquiry.proName}
              {inquiry.brokerage ? `, ${inquiry.brokerage}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-body text-neutral-700">We are matching you with a local professional.</p>
          )}
        </div>
        {inquiry.proName && (
          <Button variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "Hide messages" : "Messages"}
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <ul className="space-y-2">
            {(thread.data ?? []).map((m) => (
              <li key={m.id} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-body", m.mine ? "ml-auto bg-accent/10" : "bg-neutral-100")}>
                <span className="block text-small text-neutral-600">{m.mine ? "You" : m.senderName}</span>
                {m.body}
              </li>
            ))}
            {thread.data && !thread.data.length && <li className="text-small text-neutral-600">No messages yet.</li>}
          </ul>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) send.mutate(); }}>
            <label htmlFor={`${id}-msg`} className="sr-only">Message {inquiry.proName}</label>
            <input id={`${id}-msg`} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={`Message ${inquiry.proName}`} className="h-11 flex-1 rounded-md border border-neutral-300 px-3 text-base" />
            <Button type="submit" disabled={send.isPending}>Send</Button>
          </form>
        </div>
      )}

      {inquiry.status === "closed" && inquiry.proName && (
        <div className="mt-4 border-t border-neutral-200 pt-4">
          {reviewState === "sent" ? (
            <p role="status" className="text-body text-neutral-800">Thanks for your review. It will appear once checked.</p>
          ) : (
            <form onSubmit={submitReview} className="grid gap-3" noValidate>
              <fieldset>
                <legend className="text-small font-medium text-neutral-800">Rate {inquiry.proName}</legend>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" aria-pressed={rating === n} aria-label={`${n} ${n === 1 ? "star" : "stars"}`} onClick={() => setRating(n)} className={cn("grid size-11 place-items-center rounded-md text-h2", n <= rating ? "text-warning" : "text-neutral-300")}>
                      ★
                    </button>
                  ))}
                </div>
              </fieldset>
              <label htmlFor={`${id}-review`} className="text-small font-medium text-neutral-800">Your review (optional)</label>
              <textarea id={`${id}-review`} rows={3} maxLength={2000} value={review} onChange={(e) => setReview(e.target.value)} className="rounded-md border border-neutral-300 p-3 text-base" />
              {reviewError && <p role="alert" className="text-small text-danger">{reviewError}</p>}
              <div><Button type="submit">Submit review</Button></div>
            </form>
          )}
        </div>
      )}
    </li>
  );
}
