"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ZipOption } from "@/lib/zips";
import { LeadPreferences, prefsToPayload, ZipPicker, type LeadPrefs } from "./ZipPicker";

type Draft = {
  proType: "agent" | "landlord";
  displayName: string;
  brokerageName: string;
  licenseNumber: string;
  phone: string;
  yearsExperience: string;
  languages: string;
  bio: string;
  zipCodes: string[];
  prefs: LeadPrefs;
};

const STEPS = ["Role", "Details", "ZIP codes", "Review"] as const;
const ROLES = [
  { value: "agent", label: "Real estate agent", hint: "Buyer and seller leads for homes in your ZIP codes" },
  { value: "landlord", label: "Landlord or property manager", hint: "Post rentals and receive inquiries" },
] as const;

/** Partner signup: role, details with license, ZIP codes and lead preferences, review. */
export function ProSignupWizard({ zips, defaultName }: { zips: ZipOption[]; defaultName: string }) {
  const router = useRouter();
  const { update } = useSession();
  const id = useId();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({ proType: "agent", displayName: defaultName, brokerageName: "", licenseNumber: "", phone: "", yearsExperience: "", languages: "en", bio: "", zipCodes: [], prefs: { priceMin: "", priceMax: "", homeTypes: [] } });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const licensed = draft.proType !== "landlord";

  const validateStep = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (draft.displayName.trim().length < 2) e.displayName = "Enter the name clients will see.";
      if (licensed && !draft.licenseNumber.trim()) e.licenseNumber = "Enter your license number.";
      if (!/^\+?\d{10,15}$/.test(draft.phone.replace(/[^\d+]/g, ""))) e.phone = "Enter a phone number with area code.";
    }
    if (step === 2 && licensed && !draft.zipCodes.length) e.zipCodes = "Choose at least one ZIP code you serve.";
    if (step === 2 && draft.prefs.priceMin && draft.prefs.priceMax && Number(draft.prefs.priceMin) > Number(draft.prefs.priceMax)) e.zipCodes = "The lowest price must be below the highest price.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const next = () => validateStep() && setStep((s) => Math.min(STEPS.length - 1, s + 1));

  const submit = async () => {
    setBusy(true);
    setSummary(null);
    const res = await fetch("/api/pro/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proType: draft.proType,
        displayName: draft.displayName,
        brokerageName: draft.brokerageName || undefined,
        licenseNumber: draft.licenseNumber || undefined,
        phone: draft.phone,
        yearsExperience: draft.yearsExperience ? Number(draft.yearsExperience) : undefined,
        languages: draft.languages.split(/[\s,]+/).filter(Boolean),
        bio: draft.bio || undefined,
        zipCodes: licensed ? draft.zipCodes : [],
        ...(licensed ? prefsToPayload(draft.prefs) : {}),
      }),
    });
    const body = (await res.json().catch(() => null)) as { error?: { message: string; fields?: Record<string, string[]> } } | null;
    setBusy(false);
    if (!res.ok) {
      setSummary(body?.error?.message ?? "We could not create your profile.");
      const f: Record<string, string> = {};
      for (const [k, v] of Object.entries(body?.error?.fields ?? {})) f[k] = v[0];
      setErrors(f);
      return;
    }
    // Refresh roles in the session token. update() needs a payload: without one next-auth sends a
    // plain GET and the jwt callback never sees trigger "update".
    await update({ refresh: "roles" });
    router.push(draft.proType === "landlord" ? "/landlord" : "/pro/profile?welcome=1");
    router.refresh();
  };

  const text = (key: keyof Draft, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid gap-1">
      <label htmlFor={`${id}-${key}`} className="text-small font-medium text-neutral-800">
        {label}
      </label>
      <Input
        id={`${id}-${key}`}
        value={draft[key] as string}
        onChange={(e) => set({ [key]: e.target.value } as Partial<Draft>)}
        aria-invalid={!!errors[key] || undefined}
        aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
        {...props}
      />
      {errors[key] && (
        <p id={`${id}-${key}-error`} className="text-small text-danger">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl">
      <ol className="mb-8 flex gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={cn("flex-1 border-t-4 pt-2 text-small", i <= step ? "border-accent font-semibold text-neutral-900" : "border-neutral-200 text-neutral-500")}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      {summary && (
        <p role="alert" className="mb-4 rounded-md bg-danger/5 px-3 py-2 text-small text-danger">
          {summary}
        </p>
      )}

      {step === 0 && (
        <fieldset>
          <legend className="mb-3 text-h3">What do you do?</legend>
          <div className="grid gap-2">
            {ROLES.map((r) => (
              <label key={r.value} className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-md border px-4", draft.proType === r.value ? "border-accent bg-accent/5" : "border-neutral-300")}>
                <input type="radio" name="proType" value={r.value} checked={draft.proType === r.value} onChange={() => set({ proType: r.value })} className="size-5 accent-[var(--color-accent)]" />
                <span>
                  <span className="block text-body font-medium">{r.label}</span>
                  <span className="block text-small text-neutral-600">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {step === 1 && (
        <div className="grid gap-4">
          {text("displayName", "Name clients will see", { autoComplete: "name" })}
          {licensed && text("brokerageName", "Brokerage (optional)", { autoComplete: "organization" })}
          {licensed && text("licenseNumber", "California DRE license number")}
          {text("phone", "Business phone", { type: "tel", inputMode: "tel", autoComplete: "tel" })}
          {licensed && text("yearsExperience", "Years of experience (optional)", { type: "number", inputMode: "numeric", min: 0 })}
          {text("languages", "Languages (codes, for example en, fr)")}
          <div className="grid gap-1">
            <label htmlFor={`${id}-bio`} className="text-small font-medium text-neutral-800">
              About you (optional)
            </label>
            <textarea id={`${id}-bio`} rows={4} maxLength={1500} value={draft.bio} onChange={(e) => set({ bio: e.target.value })} className="rounded-md border border-neutral-300 p-3 text-base" />
          </div>
        </div>
      )}

      {step === 2 &&
        (licensed ? (
          <div className="grid gap-8">
            <ZipPicker zips={zips} value={draft.zipCodes} onChange={(zipCodes) => set({ zipCodes })} error={errors.zipCodes} />
            <LeadPreferences value={draft.prefs} onChange={(prefs) => set({ prefs })} />
          </div>
        ) : (
          <p className="text-body text-neutral-700">Landlords receive inquiries on the rentals they post, so there is nothing to choose here.</p>
        ))}

      {step === 3 && (
        <div className="space-y-3 rounded-lg border border-neutral-200 p-5">
          <h2 className="text-h3">Review</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
            <dt className="text-neutral-600">Role</dt>
            <dd>{ROLES.find((r) => r.value === draft.proType)?.label}</dd>
            <dt className="text-neutral-600">Name</dt>
            <dd>{draft.displayName}</dd>
            {licensed && (
              <>
                <dt className="text-neutral-600">License</dt>
                <dd>{draft.licenseNumber}</dd>
              </>
            )}
            <dt className="text-neutral-600">Phone</dt>
            <dd>{draft.phone}</dd>
            {licensed && (
              <>
                <dt className="text-neutral-600">ZIP codes</dt>
                <dd>{draft.zipCodes.join(", ")}</dd>
              </>
            )}
          </dl>
          {licensed && <p className="text-small text-neutral-600">We verify licenses with the regulator before you receive leads. This typically takes one business day.</p>}
        </div>
      )}

      <div className="mt-8 flex justify-between gap-2">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>Continue</Button>
        ) : (
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            Create my profile
          </Button>
        )}
      </div>
    </div>
  );
}
