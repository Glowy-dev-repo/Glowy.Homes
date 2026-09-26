"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brand } from "@/config/brand";
import type { LeadType } from "@/db/schema/leads";
import { CONSENT_TEXT } from "@/lib/leads/schema";
import { cn } from "@/lib/utils";
import { Turnstile } from "./Turnstile";

type Assigned = { name: string; photoUrl: string | null; brokerage: string | null } | null;

const SLOTS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
] as const;

const initials = (name: string) => name.split(" ").map((w) => w[0]).slice(0, 2).join("");

function nextDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 1; i <= n; i++) {
    const x = new Date(d.getTime() + i * 86_400_000);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * docs/04 LeadForm (ContactAgent and TourScheduler). Loading, success and error states; errors
 * inline with a summary at the top; consent required in plain language.
 */
export function LeadForm({
  leadType,
  listingId,
  propertyId,
  proId,
  address,
  defaultMessage,
  submitLabel,
  onDone,
}: {
  leadType: LeadType;
  listingId?: string;
  propertyId?: string;
  proId?: string;
  address?: string;
  defaultMessage?: string;
  submitLabel?: string;
  onDone?: () => void;
}) {
  const { data: session } = useSession();
  const id = useId();
  const days = nextDays(14);
  const [mode, setMode] = useState<"in_person" | "video">("in_person");
  const [windows, setWindows] = useState([{ date: days[0], slot: "afternoon" }, { date: days[1], slot: "morning" }, { date: days[2], slot: "evening" }]);
  const [state, setState] = useState<"idle" | "sending" | "matching" | "done">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<Assigned>(null);
  const tokenRef = useRef<string | undefined>(undefined);
  const onToken = useCallback((t: string) => (tokenRef.current = t), []);
  const tour = leadType === "tour";

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    setErrors({});
    setSummary(null);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadType,
        listingId,
        propertyId,
        proId,
        name: f.get("name"),
        email: f.get("email"),
        phone: f.get("phone") || undefined,
        message: f.get("message") || undefined,
        consent: f.get("consent") === "on",
        citySlug: f.get("citySlug") || undefined,
        tour: tour ? { mode, windows } : undefined,
        sourcePage: window.location.pathname,
        turnstileToken: tokenRef.current,
      }),
    }).catch(() => null);
    if (!res) {
      setSummary("We could not reach the server. Check your connection and try again.");
      setState("idle");
      return;
    }
    const body = (await res.json().catch(() => null)) as { data?: { leadId: string; statusToken: string }; error?: { message: string; fields?: Record<string, string[]> } } | null;
    if (!res.ok || !body?.data) {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(body?.error?.fields ?? {})) fields[k] = v[0];
      setErrors(fields);
      setSummary(body?.error?.message ?? "Something went wrong. Try again.");
      setState("idle");
      e.currentTarget?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }

    // docs/04: show the assigned pro when routing completes within 5 seconds.
    setState("matching");
    const { leadId, statusToken } = body.data;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 800));
      const s = await fetch(`/api/leads/${leadId}/status?token=${statusToken}`).then((r) => r.json()).catch(() => null);
      if (s?.data?.pro) {
        setAssigned(s.data.pro);
        break;
      }
    }
    setState("done");
  };

  if (state === "done" || state === "matching") {
    return (
      <div role="status" className="py-4" data-testid="lead-success">
        {state === "matching" ? (
          <p className="flex items-center gap-2 text-body text-neutral-800">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Sent. Finding the right professional for you.
          </p>
        ) : assigned ? (
          <div className="flex items-center gap-3">
            {assigned.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- pro photos are user uploads on the media CDN, not listing media
              <img src={assigned.photoUrl} alt="" className="size-14 rounded-full object-cover" />
            ) : (
              <span aria-hidden className="grid size-14 place-items-center rounded-full bg-accent/10 text-h3 text-accent">
                {initials(assigned.name)}
              </span>
            )}
            <div>
              <p className="flex items-center gap-2 text-h3">
                <CheckCircle2 className="size-5 text-success" aria-hidden />
                <span data-testid="assigned-pro">{assigned.name}</span> will be in touch
              </p>
              <p className="text-small text-neutral-600">{assigned.brokerage ?? "Typically replies within a few hours."}</p>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-body text-neutral-900">
            <CheckCircle2 className="size-5 text-success" aria-hidden />
            We&apos;ll match you with an agent shortly.
          </p>
        )}
        {state === "done" && onDone && (
          <Button className="mt-5" onClick={onDone}>
            Done
          </Button>
        )}
      </div>
    );
  }

  const field = (name: string, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid gap-1">
      <label htmlFor={`${id}-${name}`} className="text-small font-medium text-neutral-800">
        {label}
      </label>
      <Input id={`${id}-${name}`} name={name} aria-invalid={!!errors[name] || undefined} aria-describedby={errors[name] ? `${id}-${name}-error` : undefined} {...props} />
      {errors[name] && (
        <p id={`${id}-${name}-error`} className="text-small text-danger">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-4" data-testid="lead-form">
      {summary && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-small text-danger">
          {summary}
        </p>
      )}
      {field("name", "Name", { autoComplete: "name", defaultValue: session?.user?.name ?? "" })}
      {field("email", "Email", { type: "email", autoComplete: "email", inputMode: "email", defaultValue: session?.user?.email ?? "" })}
      {field("phone", "Phone (optional)", { type: "tel", autoComplete: "tel", inputMode: "tel" })}

      {leadType === "preapproval" && !listingId && !propertyId && (
        <div className="grid gap-1">
          <label htmlFor={`${id}-city`} className="text-small font-medium text-neutral-800">
            Where are you buying?
          </label>
          <select id={`${id}-city`} name="citySlug" defaultValue={brand.market.cities[0].slug} className="h-11 rounded-md border border-neutral-300 bg-white px-3 text-base">
            {brand.market.cities.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {tour && (
        <fieldset className="grid gap-3">
          <legend className="text-small font-medium text-neutral-800">Tour type</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["in_person", "video"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn("min-h-11 rounded-md border text-body font-medium", mode === m ? "border-accent bg-accent/10 text-accent" : "border-neutral-300")}
              >
                {m === "in_person" ? "In person" : "Video"}
              </button>
            ))}
          </div>
          <p className="text-small font-medium text-neutral-800">Pick up to three times that work</p>
          {windows.map((w, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <label className="sr-only" htmlFor={`${id}-date-${i}`}>{`Choice ${i + 1} date`}</label>
              <select
                id={`${id}-date-${i}`}
                value={w.date}
                onChange={(e) => setWindows((ws) => ws.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))}
                className="h-11 rounded-md border border-neutral-300 bg-white px-2 text-base"
              >
                {days.map((d) => (
                  <option key={d} value={d}>
                    {new Date(`${d}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor={`${id}-slot-${i}`}>{`Choice ${i + 1} time`}</label>
              <select
                id={`${id}-slot-${i}`}
                value={w.slot}
                onChange={(e) => setWindows((ws) => ws.map((x, j) => (j === i ? { ...x, slot: e.target.value } : x)))}
                className="h-11 rounded-md border border-neutral-300 bg-white px-2 text-base"
              >
                {SLOTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </fieldset>
      )}

      <div className="grid gap-1">
        <label htmlFor={`${id}-message`} className="text-small font-medium text-neutral-800">
          Message
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          rows={3}
          maxLength={2000}
          defaultValue={defaultMessage ?? (address ? `I'd like to know more about ${address}` : "")}
          className="rounded-md border border-neutral-300 p-3 text-base"
        />
      </div>

      <div>
        <label className="flex items-start gap-3 text-small text-neutral-800">
          <input
            type="checkbox"
            name="consent"
            aria-invalid={!!errors.consent || undefined}
            aria-describedby={errors.consent ? `${id}-consent-error` : undefined}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
          />
          <span>{CONSENT_TEXT}</span>
        </label>
        {errors.consent && (
          <p id={`${id}-consent-error`} className="mt-1 text-small text-danger">
            {errors.consent}
          </p>
        )}
      </div>

      <Turnstile onToken={onToken} />

      <Button type="submit" size="lg" disabled={state === "sending"}>
        {state === "sending" && <Loader2 className="animate-spin" aria-hidden />}
        {submitLabel ?? (tour ? "Request a tour" : "Send message")}
      </Button>
    </form>
  );
}
