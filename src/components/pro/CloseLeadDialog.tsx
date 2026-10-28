"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseDollars } from "@/lib/leads/closing";

/** Marking a lead Closed asks for the sale price and closing date (Glowy Homes' referral statement). */
export function CloseLeadDialog({ leadId, consumerName, onClose, onDone }: { leadId: string | null; consumerName: string; onClose: () => void; onDone: () => void }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!leadId) return;
    const f = new FormData(e.currentTarget);
    const price = parseDollars(String(f.get("closePrice") ?? ""));
    if (price === null) {
      setErrors({ closePrice: "Enter the sale price in dollars, like 850,000." });
      setSummary(null);
      return;
    }
    setBusy(true);
    setErrors({});
    setSummary(null);
    const res = await fetch(`/api/pro/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed", closePrice: price, closeDate: f.get("closeDate") || undefined }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { error?: { message?: string; fields?: Record<string, string[]> } } | null;
    setBusy(false);
    if (!res?.ok) {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(body?.error?.fields ?? {})) fields[k] = v[0];
      setErrors(fields);
      setSummary(Object.keys(fields).length ? null : (body?.error?.message ?? "Could not save. Try again."));
      return;
    }
    onDone();
  };

  const field = (name: "closePrice" | "closeDate", label: string, props: React.ComponentProps<typeof Input>) => (
    <div className="grid gap-1">
      <label htmlFor={`${id}-${name}`} className="text-small font-medium text-neutral-800">{label}</label>
      <Input id={`${id}-${name}`} name={name} required aria-invalid={!!errors[name] || undefined} aria-describedby={errors[name] ? `${id}-${name}-e` : undefined} {...props} />
      {errors[name] && <p id={`${id}-${name}-e`} className="text-small text-danger">{errors[name]}</p>}
    </div>
  );

  return (
    <Dialog.Root open={!!leadId} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-neutral-900/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-raised">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-h3">Close the lead for {consumerName}</Dialog.Title>
            <Dialog.Close className="grid size-11 place-items-center rounded-md hover:bg-neutral-100" aria-label="Cancel">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-body text-neutral-600">Glowy Homes uses this for your referral statement.</Dialog.Description>
          <form onSubmit={submit} className="mt-5 space-y-4" data-testid="close-lead-form">
            {field("closePrice", "Sale price ($)", { inputMode: "numeric", autoComplete: "off" })}
            {field("closeDate", "Closing date", { type: "date" })}
            {summary && <p role="alert" className="text-small text-danger">{summary}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="animate-spin" aria-hidden />}
                Mark as closed
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
