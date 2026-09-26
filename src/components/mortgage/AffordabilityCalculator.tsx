"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { affordabilityRange, qualifyingRate } from "@/lib/affordability";
import { formatPrice } from "@/lib/format";
import { DEFAULT_RATE_PERCENT } from "@/lib/mortgage";

/** docs/01 B1. The result is an estimate: a range, a confidence label and a disclaimer (CLAUDE.md rule 8). */
export function AffordabilityCalculator() {
  const id = useId();
  const [v, setV] = useState({ annualIncome: 150000, monthlyDebts: 500, downPayment: 100000, ratePercent: DEFAULT_RATE_PERCENT });
  const range = affordabilityRange(v);
  const field = (key: keyof typeof v, label: string, step: number) => (
    <div className="grid gap-1">
      <label htmlFor={`${id}-${key}`} className="text-small font-medium text-neutral-800">{label}</label>
      <Input id={`${id}-${key}`} type="number" inputMode="decimal" min={0} step={step} value={v[key]} onChange={(e) => setV((s) => ({ ...s, [key]: Number(e.target.value) || 0 }))} />
    </div>
  );
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="grid gap-3 sm:grid-cols-2">
        {field("annualIncome", "Household income ($ per year)", 1000)}
        {field("monthlyDebts", "Monthly debt payments ($)", 50)}
        {field("downPayment", "Down payment ($)", 1000)}
        {field("ratePercent", "Interest rate (%)", 0.05)}
      </div>
      <div className="rounded-lg bg-neutral-50 p-5" aria-live="polite" data-testid="affordability-result">
        <p className="text-small text-neutral-700">You could likely afford</p>
        {range.mid > 0 ? (
          <p className="tabular text-price">{formatPrice(range.low)} to {formatPrice(range.high)}</p>
        ) : (
          <p className="text-body text-neutral-800">These numbers do not qualify for a mortgage. Try a larger down payment or lower debts.</p>
        )}
        <p className="mt-1 text-small text-neutral-700">Confidence: <span className="font-semibold">Medium</span>. Lenders qualify you at {qualifyingRate(v.ratePercent).toFixed(2)}%, and the range covers rates half a point either side of yours.</p>
        <p className="mt-3 text-small text-neutral-600">This is an estimate, not a preapproval or loan offer. Approval depends on your credit, income verification and the lender&apos;s rules.</p>
      </div>
    </div>
  );
}
