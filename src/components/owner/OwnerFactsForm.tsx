"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { areaUnitLabel, fromSqft, toSqft } from "@/lib/format";

const CONDITIONS = [
  { value: "needs_work", label: "Needs work" },
  { value: "average", label: "Average" },
  { value: "good", label: "Good, recently updated" },
  { value: "excellent", label: "Excellent, fully renovated" },
];

/** Owner edits beds, baths, size, year built and condition; the estimate recalculates (docs/01 US5). */
export function OwnerFactsForm({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: { beds: number | null; baths: number | null; sqft: number | null; yearBuilt: number | null; condition: string | null };
}) {
  const router = useRouter();
  const id = useId();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const num = (k: string) => (f.get(k) === "" || f.get(k) === null ? undefined : Number(f.get(k)));
    const area = num("area");
    setState("saving");
    setErrors({});
    const res = await fetch(`/api/properties/${propertyId}/facts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beds: num("beds"),
        baths: num("baths"),
        sqft: area !== undefined ? toSqft(area) : undefined,
        yearBuilt: num("yearBuilt"),
        condition: f.get("condition") || undefined,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { fields?: Record<string, string[]> } } | null;
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(body?.error?.fields ?? {})) fields[k === "sqft" ? "area" : k] = v[0];
      setErrors(fields);
      setState("error");
      return;
    }
    setState("saved");
    router.refresh();
  };

  const field = (name: string, label: string, defaultValue: number | null, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid gap-1">
      <label htmlFor={`${id}-${name}`} className="text-small font-medium text-neutral-800">
        {label}
      </label>
      <Input
        id={`${id}-${name}`}
        name={name}
        type="number"
        inputMode="decimal"
        defaultValue={defaultValue ?? ""}
        aria-invalid={!!errors[name] || undefined}
        aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
        {...props}
      />
      {errors[name] && (
        <p id={`${id}-${name}-error`} className="text-small text-danger">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-4" data-testid="owner-facts-form">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {field("beds", "Bedrooms", initial.beds, { step: 1, min: 0, max: 20 })}
        {field("baths", "Bathrooms", initial.baths, { step: 0.5, min: 0, max: 20 })}
        {field("area", `Interior area (${areaUnitLabel})`, initial.sqft ? fromSqft(initial.sqft) : null, { step: 1, min: 10 })}
        {field("yearBuilt", "Year built", initial.yearBuilt, { step: 1, min: 1800 })}
      </div>
      <div className="grid gap-1 sm:max-w-xs">
        <label htmlFor={`${id}-condition`} className="text-small font-medium text-neutral-800">
          Condition
        </label>
        <select id={`${id}-condition`} name="condition" defaultValue={initial.condition ?? "average"} className="h-11 rounded-md border border-neutral-300 bg-white px-3 text-base">
          {CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={state === "saving"}>
          {state === "saving" && <Loader2 className="animate-spin" aria-hidden />}
          {state === "saving" ? "Updating estimate" : "Save and update estimate"}
        </Button>
        <p role="status" className="text-small text-neutral-700">
          {state === "saved" ? "Saved. Your estimate is updated." : state === "error" && !Object.keys(errors).length ? "We could not save those facts. Try again." : ""}
        </p>
      </div>
    </form>
  );
}
