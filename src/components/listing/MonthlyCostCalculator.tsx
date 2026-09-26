"use client";

import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { market } from "@/config/market";
import { DEFAULT_AMORTIZATION_YEARS, DEFAULT_RATE_PERCENT, monthlyCost, monthlyCostRange, RATE_SPREAD, type MortgageInputs } from "@/lib/mortgage";

// Versioned by market, so saved inputs from another market's defaults are not reused.
const STORAGE_KEY = `gh:mortgage-inputs:${market.regionCode}`;
type Persisted = Pick<MortgageInputs, "downPaymentPercent" | "ratePercent" | "amortizationYears" | "insuranceMonthly">;
const DEFAULTS: Persisted = { downPaymentPercent: 20, ratePercent: DEFAULT_RATE_PERCENT, amortizationYears: DEFAULT_AMORTIZATION_YEARS, insuranceMonthly: 125 };
const US = market.finance.mortgageInsurance.kind === "monthly_pmi";
const FEE_LABEL = US ? "HOA fee" : "Condo or HOA fee";

/**
 * docs/01 LDP section 10: principal and interest, tax, insurance and condo fee, all editable.
 * Personal inputs persist in local storage across listings. The total is an estimate, so it is
 * shown as a range with a confidence label and a disclaimer (CLAUDE.md rule 8).
 */
export function MonthlyCostCalculator({ price, taxAnnual, hoaMonthly }: { price: number; taxAnnual: number | null; hoaMonthly: number | null }) {
  const id = useId();
  const [persisted, setPersisted] = useState<Persisted>(DEFAULTS);
  const [homePrice, setHomePrice] = useState(price);
  const [tax, setTax] = useState(taxAnnual ?? Math.round(price * market.finance.taxRate));
  const [hoa, setHoa] = useState(hoaMonthly ?? 0);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Persisted> | null;
      if (saved) setPersisted((p) => ({ ...p, ...saved }));
    } catch {
      // ignore
    }
  }, []);

  const update = (patch: Partial<Persisted>) => {
    setPersisted((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable
      }
      return next;
    });
  };

  const inputs: MortgageInputs = { price: homePrice || 1, propertyTaxAnnual: tax, hoaMonthly: hoa, ...persisted };
  const cost = monthlyCost(inputs);
  const range = monthlyCostRange(inputs);

  const field = (label: string, value: number, onChange: (v: number) => void, opts: { suffix?: string; step?: number; min?: number; max?: number } = {}) => {
    const fid = `${id}-${label.replace(/\W+/g, "-")}`;
    return (
      <div>
        <label htmlFor={fid} className="mb-1 block text-small text-neutral-700">
          {label}
          {opts.suffix ? ` (${opts.suffix})` : ""}
        </label>
        <Input
          id={fid}
          type="number"
          inputMode="decimal"
          step={opts.step ?? 1}
          min={opts.min ?? 0}
          max={opts.max}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />
      </div>
    );
  };

  const rows = [
    { label: "Principal and interest", value: cost.principalAndInterest },
    { label: "Property tax", value: cost.propertyTax },
    { label: "Home insurance", value: cost.insurance },
    { label: FEE_LABEL, value: cost.hoa },
    ...(cost.mortgageInsuranceMonthly > 0 ? [{ label: "Mortgage insurance (PMI)", value: cost.mortgageInsuranceMonthly }] : []),
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="grid gap-3 sm:grid-cols-2">
        {field("Home price", homePrice, setHomePrice, { suffix: "$", step: 1000 })}
        {field("Down payment", persisted.downPaymentPercent, (v) => update({ downPaymentPercent: Math.min(100, v) }), { suffix: "%", step: 1, max: 100 })}
        {field("Interest rate", persisted.ratePercent, (v) => update({ ratePercent: Math.min(25, v) }), { suffix: "%", step: 0.05, max: 25 })}
        {field(US ? "Loan term" : "Amortization", persisted.amortizationYears, (v) => update({ amortizationYears: Math.min(30, Math.max(5, Math.round(v))) }), { suffix: "years", min: 5, max: 30 })}
        {field("Property tax", tax, setTax, { suffix: "$ per year", step: 100 })}
        {field("Home insurance", persisted.insuranceMonthly, (v) => update({ insuranceMonthly: v }), { suffix: "$ per month", step: 10 })}
        {field(FEE_LABEL, hoa, setHoa, { suffix: "$ per month", step: 10 })}
      </div>

      <div className="rounded-lg bg-neutral-50 p-5" aria-live="polite" data-testid="monthly-cost">
        <p className="text-small text-neutral-700">Estimated monthly cost</p>
        <p className="tabular text-price text-neutral-900">
          {formatPrice(Math.round(range.low))} to {formatPrice(Math.round(range.high))}
        </p>
        <p className="text-small text-neutral-700">
          Confidence: <span className="font-semibold text-neutral-900">Medium</span>. The range covers rates {RATE_SPREAD} points either side of your rate.
        </p>
        <dl className="mt-4 space-y-2 text-body">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-3">
              <dt className="text-neutral-700">{r.label}</dt>
              <dd className="tabular text-neutral-900">{formatPrice(Math.round(r.value))}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-neutral-200 pt-2 font-semibold">
            <dt>At your rate</dt>
            <dd className="tabular">{formatPrice(Math.round(cost.total))}</dd>
          </div>
        </dl>
        {cost.mortgageInsuranceMonthly > 0 && (
          <p className="mt-3 text-small text-neutral-700">
            Includes private mortgage insurance of about {formatPrice(Math.round(cost.mortgageInsuranceMonthly))} a month, which lenders typically require below 20% down.
          </p>
        )}
        {cost.insurancePremium > 0 && (
          <p className="mt-3 text-small text-neutral-700">
            Includes a mortgage default insurance premium of about {formatPrice(Math.round(cost.insurancePremium))} added to the loan, which typically applies below 20% down.
          </p>
        )}
        {cost.belowMinimumDown && (
          <p role="alert" className="mt-3 text-small text-danger">
            This down payment is below the usual minimum for this price. Lenders typically require more.
          </p>
        )}
        <p className="mt-3 text-small text-neutral-600">
          This is an estimate, not a loan offer. Actual payments depend on your lender, rate, terms and approval.
        </p>
      </div>
    </div>
  );
}
