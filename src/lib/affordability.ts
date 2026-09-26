import { minimumDownPayment, monthlyPrincipalAndInterest } from "./mortgage";

// Affordability calculator (docs/01 B1): income, debts, down payment and rate to a maximum price.
// Uses the usual Canadian lender limits: housing costs within 39% of gross income (GDS) and all
// debts within 44% (TDS), qualified at the stress test rate (the greater of rate + 2 and 5.25%).

export type AffordabilityInput = { annualIncome: number; monthlyDebts: number; downPayment: number; ratePercent: number; amortizationYears?: number };

const HEATING = 100;
const TAX_RATE = 0.007;

export function qualifyingRate(rate: number): number {
  return Math.max(rate + 2, 5.25);
}

/** Largest price whose qualifying payment fits both ratios and whose down payment meets the minimum. */
export function maxPrice(input: AffordabilityInput, ratePercent = input.ratePercent): number {
  const monthlyIncome = input.annualIncome / 12;
  const years = input.amortizationYears ?? 25;
  const q = qualifyingRate(ratePercent);
  const fits = (price: number) => {
    if (input.downPayment < minimumDownPayment(price)) return false;
    const loan = Math.max(0, price - input.downPayment);
    const housing = monthlyPrincipalAndInterest(loan, q, years) + (price * TAX_RATE) / 12 + HEATING;
    return housing <= 0.39 * monthlyIncome && housing + input.monthlyDebts <= 0.44 * monthlyIncome;
  };
  let lo = 0;
  let hi = 20_000_000;
  if (!fits(input.downPayment)) return 0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo / 1000) * 1000;
}

/** A range for rates half a point either side, so the answer is never a single number. */
export function affordabilityRange(input: AffordabilityInput) {
  return {
    low: maxPrice(input, input.ratePercent + 0.5),
    mid: maxPrice(input),
    high: maxPrice(input, Math.max(0, input.ratePercent - 0.5)),
  };
}
