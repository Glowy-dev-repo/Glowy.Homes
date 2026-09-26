"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RentalApplicationProfile } from "@/lib/listings/user-listing-schema";

/** One reusable rental application (docs/01 R4): fill it once, send it to any rental. */
export function ApplicationForm({ initial, email, next }: { initial: RentalApplicationProfile | null; email: string; next?: string }) {
  const router = useRouter();
  const id = useId();
  const [refs, setRefs] = useState(initial?.references ?? []);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("saving");
    setErrors({});
    const res = await fetch("/api/rentals/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: f.get("fullName"),
        email: f.get("email"),
        phone: f.get("phone"),
        moveInDate: f.get("moveInDate"),
        occupants: Number(f.get("occupants")),
        pets: f.get("pets") ?? "",
        employer: f.get("employer") ?? "",
        jobTitle: f.get("jobTitle") ?? "",
        annualIncome: Number(f.get("annualIncome")),
        references: refs.filter((r) => r.name.trim()),
        notes: f.get("notes") ?? "",
      }),
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { error?: { fields?: Record<string, string[]> } } | null;
      const fe: Record<string, string> = {};
      for (const [k, v] of Object.entries(b?.error?.fields ?? {})) fe[k] = v[0];
      setErrors(fe);
      setState("idle");
      return;
    }
    setState("saved");
    if (next) router.push(next);
    else router.refresh();
  };

  const field = (name: keyof RentalApplicationProfile, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid gap-1">
      <label htmlFor={`${id}-${name}`} className="text-small font-medium text-neutral-800">{label}</label>
      <Input id={`${id}-${name}`} name={name} defaultValue={(initial?.[name] as string | number | undefined) ?? (name === "email" ? email : "")} aria-invalid={!!errors[name] || undefined} aria-describedby={errors[name] ? `${id}-${name}-e` : undefined} {...props} />
      {errors[name] && <p id={`${id}-${name}-e`} className="text-small text-danger">{errors[name]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="grid max-w-2xl gap-6">
      {Object.keys(errors).length > 0 && <p role="alert" className="rounded-md bg-danger/5 px-3 py-2 text-small text-danger">Check the highlighted fields.</p>}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-h3">About you</legend>
        {field("fullName", "Full name", { autoComplete: "name" })}
        {field("email", "Email", { type: "email", autoComplete: "email" })}
        {field("phone", "Phone", { type: "tel", autoComplete: "tel" })}
        {field("moveInDate", "Move in date", { type: "date" })}
        {field("occupants", "People who will live there", { type: "number", min: 1, max: 12 })}
        {field("pets", "Pets (optional)", { placeholder: "One small dog" })}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-h3">Work and income</legend>
        {field("employer", "Employer (optional)", { autoComplete: "organization" })}
        {field("jobTitle", "Job title (optional)", { autoComplete: "organization-title" })}
        {field("annualIncome", "Household income ($ per year)", { type: "number", min: 0, step: 1000 })}
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-h3">References (optional)</legend>
        {refs.map((r, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-3">
            <Input aria-label={`Reference ${i + 1} name`} placeholder="Name" value={r.name} onChange={(e) => setRefs((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
            <Input aria-label={`Reference ${i + 1} phone`} placeholder="Phone" value={r.phone} onChange={(e) => setRefs((x) => x.map((y, j) => (j === i ? { ...y, phone: e.target.value } : y)))} />
            <Input aria-label={`Reference ${i + 1} relationship`} placeholder="Relationship" value={r.relationship} onChange={(e) => setRefs((x) => x.map((y, j) => (j === i ? { ...y, relationship: e.target.value } : y)))} />
          </div>
        ))}
        {refs.length < 3 && <Button type="button" variant="ghost" className="justify-self-start" onClick={() => setRefs((x) => [...x, { name: "", phone: "", relationship: "" }])}>Add a reference</Button>}
      </fieldset>
      <div className="grid gap-1">
        <label htmlFor={`${id}-notes`} className="text-small font-medium text-neutral-800">Anything else (optional)</label>
        <textarea id={`${id}-notes`} name="notes" rows={3} maxLength={1500} defaultValue={initial?.notes ?? ""} className="rounded-md border border-neutral-300 p-3 text-base" />
      </div>
      <p className="text-small text-neutral-600">We never ask for your SIN or run credit checks. Share only what you are comfortable with.</p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={state === "saving"}>{state === "saving" && <Loader2 className="animate-spin" aria-hidden />}Save application</Button>
        <p role="status" className="text-small">{state === "saved" ? "Application saved." : ""}</p>
      </div>
    </form>
  );
}
