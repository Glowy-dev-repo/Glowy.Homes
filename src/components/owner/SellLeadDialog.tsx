"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONSENT_TEXT } from "@/lib/leads/schema";

/** "Thinking of selling?" (docs/01 V7): creates a sell lead routed to agents who cover the area. */
export function SellLeadDialog({
  propertyId,
  address,
  trigger = "Thinking of selling?",
  variant = "primary",
}: {
  propertyId: string;
  address: string;
  trigger?: string;
  variant?: "primary" | "secondary";
}) {
  const { data: session } = useSession();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    setErrors({});
    setMessage(null);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadType: "sell",
        propertyId,
        name: f.get("name"),
        email: f.get("email"),
        phone: f.get("phone") || undefined,
        message: f.get("message") || `I am thinking of selling ${address}.`,
        consent: f.get("consent") === "on",
        sourcePage: window.location.pathname,
      }),
    });
    if (res.ok) {
      setState("sent");
      return;
    }
    const body = (await res.json().catch(() => null)) as { error?: { message: string; fields?: Record<string, string[]> } } | null;
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(body?.error?.fields ?? {})) fields[k] = v[0];
    setErrors(fields);
    setMessage(body?.error?.message ?? "We could not send that. Try again.");
    setState("idle");
  };

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
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setState("idle"); }}>
      <Dialog.Trigger asChild>
        <Button variant={variant}>{trigger}</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-white p-6 shadow-raised">
          <Dialog.Title className="text-h2">Talk to a local agent</Dialog.Title>
          <Dialog.Description className="mt-1 text-body text-neutral-600">
            An agent who covers {address} will contact you about selling. There is no obligation.
          </Dialog.Description>
          {state === "sent" ? (
            <div className="mt-5" role="status">
              <p className="flex items-center gap-2 text-body text-neutral-900">
                <CheckCircle2 className="size-5 text-success" aria-hidden />
                Thanks. We will match you with an agent shortly.
              </p>
              <Dialog.Close asChild>
                <Button className="mt-5">Done</Button>
              </Dialog.Close>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-5 grid gap-4">
              {message && (
                <p role="alert" className="rounded-md bg-danger/5 px-3 py-2 text-small text-danger">
                  {message}
                </p>
              )}
              {field("name", "Name", { autoComplete: "name", defaultValue: session?.user?.name ?? "" })}
              {field("email", "Email", { type: "email", autoComplete: "email", defaultValue: session?.user?.email ?? "" })}
              {field("phone", "Phone (optional)", { type: "tel", autoComplete: "tel" })}
              <div className="grid gap-1">
                <label htmlFor={`${id}-message`} className="text-small font-medium text-neutral-800">
                  Message (optional)
                </label>
                <textarea id={`${id}-message`} name="message" rows={3} className="rounded-md border border-neutral-300 p-3 text-base" placeholder={`I am thinking of selling ${address}.`} />
              </div>
              <label className="flex items-start gap-3 text-small text-neutral-800">
                <input type="checkbox" name="consent" className="mt-0.5 size-5 accent-[var(--color-accent)]" aria-describedby={errors.consent ? `${id}-consent-error` : undefined} />
                <span>{CONSENT_TEXT}</span>
              </label>
              {errors.consent && (
                <p id={`${id}-consent-error`} className="text-small text-danger">
                  {errors.consent}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button type="submit" disabled={state === "sending"}>
                  {state === "sending" && <Loader2 className="animate-spin" aria-hidden />}
                  Contact an agent
                </Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
