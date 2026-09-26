"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALERT_FREQUENCIES, ALERT_LABELS, type AlertFrequency } from "@/lib/saved-search-schema";
import { updateSettings, type SettingsState } from "@/server/actions/account";

export function SettingsForm({
  initial,
}: {
  initial: { email: string; name: string | null; phone: string | null; savedSearchDefault: AlertFrequency; marketing: boolean };
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateSettings, { status: "idle" });
  const err = (f: string) => state.fields?.[f];

  return (
    <form action={action} className="grid max-w-lg gap-6" noValidate>
      {state.status !== "idle" && state.message && (
        <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "rounded-md bg-danger/5 px-3 py-2 text-small text-danger" : "rounded-md bg-success/10 px-3 py-2 text-small text-neutral-900"}>
          {state.message}
        </p>
      )}

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-h3">Profile</legend>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={initial.email} readOnly aria-readonly className="bg-neutral-50 text-neutral-700" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" autoComplete="name" defaultValue={state.values?.name ?? initial.name ?? ""} aria-invalid={!!err("name") || undefined} aria-describedby={err("name") ? "name-error" : undefined} />
          {err("name") && <p id="name-error" className="text-small text-danger">{err("name")}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={state.values?.phone ?? initial.phone ?? ""} aria-invalid={!!err("phone") || undefined} aria-describedby={err("phone") ? "phone-error" : undefined} />
          {err("phone") && <p id="phone-error" className="text-small text-danger">{err("phone")}</p>}
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-h3">Notifications</legend>
        <div className="grid gap-1.5">
          <Label htmlFor="savedSearchDefault">Default alert frequency for new saved searches</Label>
          <select id="savedSearchDefault" name="savedSearchDefault" defaultValue={state.values?.savedSearchDefault ?? initial.savedSearchDefault} className="h-11 rounded-md border border-neutral-300 bg-white px-3 text-base">
            {ALERT_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {ALERT_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-body text-neutral-800">
          <input type="checkbox" name="marketing" defaultChecked={state.values?.marketing ?? initial.marketing} className="size-5 accent-[var(--color-accent)]" />
          Send me occasional news and market updates
        </label>
      </fieldset>

      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? "Saving" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
