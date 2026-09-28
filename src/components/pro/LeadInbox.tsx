"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Phone, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LEAD_STATUSES } from "@/db/schema/leads";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InboxLead, LeadDetail, Message } from "@/server/data/pro-leads";

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  touring: "Touring",
  under_contract: "Under contract",
  closed: "Closed",
  lost: "Lost",
  unassigned: "Unassigned",
};
const TYPE_LABEL: Record<string, string> = { tour: "Tour", contact: "Question", sell: "Seller", rental_inquiry: "Rental", rental_application: "Application" };

type InboxData = { items: InboxLead[]; stats: { newToday: number; thisMonth: number; medianResponse: number | null; capRemaining: number } };
type Detail = { lead: LeadDetail; activity: { viewed: { id: string; address: string; price: number; at: string }[]; saved: { id: string; address: string; price: number; at: string }[]; searches: { name: string; at: string }[] }; messages: Message[] };

const minutesSince = (iso: string | null) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 60_000) : 0);

/** docs/04 LeadRow first response timer: amber at 20 minutes, red at 30. */
function ResponseTimer({ lead }: { lead: InboxLead }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  if (lead.firstResponseAt || lead.status !== "new") return <span className="text-small text-neutral-500">Responded</span>;
  const m = minutesSince(lead.assignedAt);
  return (
    <span className={cn("tabular rounded-pill px-2 py-0.5 text-small font-semibold", m >= 30 ? "bg-danger/10 text-danger" : m >= 20 ? "bg-warning/15 text-neutral-900" : "bg-neutral-100 text-neutral-800")}>
      {m} min, no reply
    </span>
  );
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "Request failed");
  return ((await res.json()) as { data: T }).data;
}

export function LeadInbox({ initialOpenId }: { initialOpenId?: string }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const qs = new URLSearchParams({ ...(status ? { status } : {}), ...(type ? { type } : {}) });
  const { data, isLoading, isError } = useQuery({ queryKey: ["pro-leads", status, type], queryFn: async () => json<InboxData>(await fetch(`/api/pro/leads?${qs}`)), refetchInterval: 30_000 });

  const patch = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: { status?: string; note?: string } }) =>
      json(await fetch(`/api/pro/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })),
    onSettled: (_d, _e, v) => {
      qc.invalidateQueries({ queryKey: ["pro-leads"] });
      qc.invalidateQueries({ queryKey: ["pro-lead", v.id] });
    },
  });

  return (
    <div>
      {data && (
        <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Lead summary">
          {[
            ["New today", data.stats.newToday],
            ["Median response", data.stats.medianResponse === null ? "None yet" : `${data.stats.medianResponse} min`],
            ["Leads this month", data.stats.thisMonth],
            ["Cap remaining today", data.stats.capRemaining],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-neutral-200 p-4">
              <dt className="text-small text-neutral-600">{label}</dt>
              <dd className="tabular text-h2">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-small">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-md border border-neutral-300 bg-white px-3 text-base">
            <option value="">All</option>
            {LEAD_STATUSES.filter((s) => s !== "unassigned").map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-small">
          Type
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-11 rounded-md border border-neutral-300 bg-white px-3 text-base">
            <option value="">All</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-body text-neutral-600"><Loader2 className="size-4 animate-spin" aria-hidden />Loading leads</p>
      ) : isError ? (
        <p role="alert" className="text-body text-danger">We could not load your leads. Refresh to try again.</p>
      ) : !data?.items.length ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-6 py-12 text-center">
          <h2 className="text-h3">No leads yet</h2>
          <p className="mt-1 text-body text-neutral-600">New leads in your areas appear here. Keep your areas and daily cap up to date in your profile.</p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200" data-testid="lead-inbox">
          {data.items.map((l) => (
            <li key={l.id} data-testid="lead-row" data-lead-id={l.id} className="flex flex-wrap items-center gap-3 p-4">
              <button type="button" onClick={() => setOpenId(l.id)} className="min-w-0 flex-1 text-left">
                <span className="block text-h3 hover:underline">{l.consumerName}</span>
                <span className="block truncate text-small text-neutral-600">
                  {TYPE_LABEL[l.leadType] ?? l.leadType}
                  {l.address ? ` · ${l.address}` : ""}
                  {l.listingPrice ? ` · ${formatPrice(l.listingPrice, { listingType: (l.listingType as "sale" | "rent") ?? "sale" })}` : ""}
                </span>
              </button>
              <span className="rounded-pill bg-accent/10 px-2 py-0.5 text-small font-semibold text-accent" aria-label={`Score ${l.score} of 100`}>
                {l.score}
              </span>
              <ResponseTimer lead={l} />
              <label className="sr-only" htmlFor={`status-${l.id}`}>Status for {l.consumerName}</label>
              <select
                id={`status-${l.id}`}
                value={l.status}
                onChange={(e) => patch.mutate({ id: l.id, body: { status: e.target.value } })}
                className="h-11 rounded-md border border-neutral-300 bg-white px-2 text-base"
                data-testid="lead-status"
              >
                {LEAD_STATUSES.filter((s) => s !== "unassigned").map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}

      <LeadDrawer id={openId} onClose={() => setOpenId(null)} onPatch={(body) => openId && patch.mutate({ id: openId, body })} />
    </div>
  );
}

function LeadDrawer({ id, onClose, onPatch }: { id: string | null; onClose: () => void; onPatch: (b: { status?: string; note?: string }) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["pro-lead", id],
    queryFn: async () => json<Detail>(await fetch(`/api/pro/leads/${id}`)),
    enabled: !!id,
  });
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const send = useMutation({
    mutationFn: async (body: string) => json(await fetch(`/api/leads/${id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) })),
    onSuccess: () => {
      setMsg("");
      qc.invalidateQueries({ queryKey: ["pro-lead", id] });
      qc.invalidateQueries({ queryKey: ["pro-leads"] });
    },
  });
  const lead = data?.lead;

  return (
    <Dialog.Root open={!!id} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto bg-white shadow-raised focus:outline-none" data-testid="lead-drawer">
          <div className="flex items-start justify-between gap-3 border-b border-neutral-200 p-5">
            <div>
              <Dialog.Title className="text-h2">{lead?.consumerName ?? "Lead"}</Dialog.Title>
              <Dialog.Description className="text-small text-neutral-600">{lead ? `${TYPE_LABEL[lead.leadType]} · ${formatDate(lead.createdAt)}` : "Loading"}</Dialog.Description>
            </div>
            <Dialog.Close className="grid size-11 place-items-center rounded-full hover:bg-neutral-100" aria-label="Close lead">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          {isLoading || !lead ? (
            <p className="p-5 text-body text-neutral-600">Loading</p>
          ) : (
            <div className="space-y-6 p-5">
              <section aria-labelledby="contact-h">
                <h3 id="contact-h" className="text-h3">Contact</h3>
                <ul className="mt-2 space-y-1 text-body">
                  <li><a href={`mailto:${lead.consumerEmail}`} className="inline-flex min-h-11 items-center gap-2 text-accent hover:underline" data-testid="lead-email"><Mail className="size-4" aria-hidden />{lead.consumerEmail}</a></li>
                  {lead.consumerPhone && <li><a href={`tel:${lead.consumerPhone}`} className="inline-flex min-h-11 items-center gap-2 text-accent hover:underline"><Phone className="size-4" aria-hidden />{lead.consumerPhone}</a></li>}
                </ul>
              </section>
              {lead.address && (
                <p className="text-body">
                  Home: {lead.listingId ? <Link href={`/listing/${lead.listingId}`} className="text-accent hover:underline">{lead.address}</Link> : lead.address}
                </p>
              )}
              {lead.message && <blockquote className="rounded-md bg-neutral-50 p-3 text-body">{lead.message}</blockquote>}
              {Array.isArray((lead.payload.tour as { windows?: unknown[] } | undefined)?.windows) && (
                <section aria-labelledby="tour-h">
                  <h3 id="tour-h" className="text-h3">Preferred tour times ({(lead.payload.tour as { mode: string }).mode === "video" ? "video" : "in person"})</h3>
                  <ul className="mt-1 list-disc pl-5 text-body">
                    {(lead.payload.tour as { windows: { date: string; slot: string }[] }).windows.map((w, i) => (
                      <li key={i}>{formatDate(w.date)}, {w.slot}</li>
                    ))}
                  </ul>
                </section>
              )}

              <section aria-labelledby="status-h">
                <h3 id="status-h" className="text-h3">Status</h3>
                <select value={lead.status} onChange={(e) => onPatch({ status: e.target.value })} className="mt-2 h-11 rounded-md border border-neutral-300 bg-white px-3 text-base" aria-label="Lead status">
                  {LEAD_STATUSES.filter((s) => s !== "unassigned").map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (note.trim()) {
                      onPatch({ note });
                      setNote("");
                    }
                  }}
                >
                  <label htmlFor="lead-note" className="sr-only">Add a note</label>
                  <input id="lead-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a private note" className="h-11 flex-1 rounded-md border border-neutral-300 px-3 text-base" />
                  <Button type="submit" variant="secondary">Add note</Button>
                </form>
              </section>

              <section aria-labelledby="thread-h">
                <h3 id="thread-h" className="text-h3">Messages</h3>
                <ul className="mt-2 space-y-2" data-testid="message-thread">
                  {data.messages.length ? (
                    data.messages.map((m) => (
                      <li key={m.id} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-body", m.mine ? "ml-auto bg-accent/10" : "bg-neutral-100")}>
                        <span className="block text-small text-neutral-600">{m.mine ? "You" : m.senderName}</span>
                        {m.body}
                      </li>
                    ))
                  ) : (
                    <li className="text-small text-neutral-600">No messages yet.</li>
                  )}
                </ul>
                {lead.consumerUserId ? (
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (msg.trim()) send.mutate(msg);
                    }}
                  >
                    <label htmlFor="lead-msg" className="sr-only">Message {lead.consumerName}</label>
                    <input id="lead-msg" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={`Message ${lead.consumerName}`} className="h-11 flex-1 rounded-md border border-neutral-300 px-3 text-base" />
                    <Button type="submit" disabled={send.isPending}>Send</Button>
                  </form>
                ) : (
                  <p className="mt-2 text-small text-neutral-600">This person does not have an account, so reply by email or phone.</p>
                )}
              </section>

              <section aria-labelledby="activity-h">
                <h3 id="activity-h" className="text-h3">Consumer activity</h3>
                {!lead.consumerUserId ? (
                  <p className="mt-1 text-small text-neutral-600">Not signed in, so no activity is available.</p>
                ) : (
                  <div className="mt-2 space-y-3 text-small">
                    <div><p className="font-medium">Recently viewed</p>{data.activity.viewed.length ? <ul className="list-disc pl-5">{data.activity.viewed.map((v) => <li key={v.id}>{v.address}, {formatPrice(v.price)}</li>)}</ul> : <p className="text-neutral-600">None</p>}</div>
                    <div><p className="font-medium">Saved homes</p>{data.activity.saved.length ? <ul className="list-disc pl-5">{data.activity.saved.map((v) => <li key={v.id}>{v.address}, {formatPrice(v.price)}</li>)}</ul> : <p className="text-neutral-600">None</p>}</div>
                    <div><p className="font-medium">Saved searches</p>{data.activity.searches.length ? <ul className="list-disc pl-5">{data.activity.searches.map((s, i) => <li key={i}>{s.name}</li>)}</ul> : <p className="text-neutral-600">None</p>}</div>
                  </div>
                )}
              </section>

              <section aria-labelledby="history-h">
                <h3 id="history-h" className="text-h3">History</h3>
                <ol className="mt-2 space-y-1 text-small text-neutral-700">
                  {lead.routingLog.map((e, i) => (
                    <li key={i}>
                      {formatDate(e.at)}: {e.action.replace(/_/g, " ")}
                      {e.status ? ` to ${STATUS_LABEL[e.status] ?? e.status}` : ""}
                      {e.note ? `: ${e.note}` : e.reason ? ` (${e.reason})` : ""}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
