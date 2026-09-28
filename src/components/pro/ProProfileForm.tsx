"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ZipOption } from "@/lib/zips";
import { LeadPreferences, prefsToPayload, ZipPicker } from "./ZipPicker";

type Initial = {
  displayName: string;
  brokerageName: string | null;
  phone: string | null;
  bio: string | null;
  languages: string[];
  yearsExperience: number | null;
  isAcceptingLeads: boolean;
  leadCapPerDay: number;
  zipCodes: string[];
  priceMin: number | null;
  priceMax: number | null;
  homeTypes: string[];
  proType: string;
};

/** Partner profile edit: details, lead preferences and the ZIP codes leads come from. */
export function ProProfileForm({ initial, zips }: { initial: Initial; zips: ZipOption[] }) {
  const router = useRouter();
  const id = useId();
  const [zipCodes, setZipCodes] = useState(initial.zipCodes);
  const [prefs, setPrefs] = useState({ priceMin: initial.priceMin?.toString() ?? "", priceMax: initial.priceMax?.toString() ?? "", homeTypes: initial.homeTypes });
  const agent = initial.proType === "agent";
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("saving");
    setErrors({});
    const res = await fetch("/api/pro/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: f.get("displayName"),
        brokerageName: f.get("brokerageName") ?? "",
        phone: f.get("phone"),
        bio: f.get("bio") ?? "",
        languages: String(f.get("languages") ?? "en").split(/[\s,]+/).filter(Boolean),
        yearsExperience: f.get("yearsExperience") ? Number(f.get("yearsExperience")) : undefined,
        isAcceptingLeads: f.get("isAcceptingLeads") === "on",
        leadCapPerDay: Number(f.get("leadCapPerDay")),
        ...(agent ? { zipCodes, ...prefsToPayload(prefs) } : {}),
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { fields?: Record<string, string[]> } } | null;
      const fe: Record<string, string> = {};
      for (const [k, v] of Object.entries(body?.error?.fields ?? {})) fe[k] = v[0];
      setErrors(fe);
      setState("error");
      return;
    }
    setState("saved");
    router.refresh();
  };

  const field = (name: string, label: string, defaultValue: string | number | null, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid gap-1">
      <label htmlFor={`${id}-${name}`} className="text-small font-medium text-neutral-800">
        {label}
      </label>
      <Input id={`${id}-${name}`} name={name} defaultValue={defaultValue ?? ""} aria-invalid={!!errors[name] || undefined} aria-describedby={errors[name] ? `${id}-${name}-e` : undefined} {...props} />
      {errors[name] && (
        <p id={`${id}-${name}-e`} className="text-small text-danger">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="grid max-w-2xl gap-6">
      {state === "error" && (
        <p role="alert" className="rounded-md bg-danger/5 px-3 py-2 text-small text-danger">
          Check the highlighted fields.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("displayName", "Name clients see", initial.displayName)}
        {field("brokerageName", "Brokerage or company", initial.brokerageName)}
        {field("phone", "Business phone", initial.phone, { type: "tel" })}
        {field("yearsExperience", "Years of experience", initial.yearsExperience, { type: "number", min: 0 })}
        {field("languages", "Languages", initial.languages.join(", "))}
        {field("leadCapPerDay", "Most leads per day", initial.leadCapPerDay, { type: "number", min: 1, max: 50 })}
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-bio`} className="text-small font-medium text-neutral-800">
          About you
        </label>
        <textarea id={`${id}-bio`} name="bio" rows={4} maxLength={1500} defaultValue={initial.bio ?? ""} className="rounded-md border border-neutral-300 p-3 text-base" />
      </div>
      <label className="flex min-h-11 items-center gap-3 text-body">
        <input type="checkbox" name="isAcceptingLeads" defaultChecked={initial.isAcceptingLeads} className="size-5 accent-[var(--color-accent)]" />
        I am accepting new leads
      </label>
      {agent && (
        <>
          <ZipPicker zips={zips} value={zipCodes} onChange={setZipCodes} error={errors.zipCodes} />
          <LeadPreferences value={prefs} onChange={setPrefs} />
          {errors.priceMax && <p role="alert" className="text-small text-danger">{errors.priceMax}</p>}
        </>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={state === "saving"}>
          {state === "saving" && <Loader2 className="animate-spin" aria-hidden />}
          Save profile
        </Button>
        <p role="status" className="text-small text-neutral-700">
          {state === "saved" ? "Profile saved." : ""}
        </p>
      </div>
    </form>
  );
}
