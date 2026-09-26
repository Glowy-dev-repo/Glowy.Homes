import { market, type FinanceRules } from "@/config/market";
import { monthlyPrincipalAndInterest } from "./mortgage";

// Affordability calculator (docs/01 B1): income, debts, down payment and rate to a maximum price,
// using the lender limits of the market (src/config/market.ts). US: housing within 28% of gross
// income and all debts within 36%, at the note rate. Canada: 39% and 44% at the stress test rate.

export type AffordabilityInput = { annualIncome: number; monthlyDebts: number; downPayment: number; ratePercent: number; amortizationYears?: number };

export function qualifyingRate(rate: number, rules: FinanceRules = market.finance): number {
  return rules.qualifyingRate(rate);
}

/** Largest price whose qualifying payment fits both ratios and whose down payment meets the minimum. */
export function maxPrice(input: AffordabilityInput, ratePercent = input.ratePercent, rules: FinanceRules = market.finance): number {
  const monthlyIncome = input.annualIncome / 12;
  const years = input.amortizationYears ?? rules.defaultAmortizationYears;
  const q = rules.qualifyingRate(ratePercent);
  const fits = (price: number) => {
    if (input.downPayment < rules.minimumDownPayment(price)) return false;
    const loan = Math.max(0, price - input.downPayment);
    const pmi = rules.mortgageInsurance.kind === "monthly_pmi" && input.downPayment < price * 0.2 ? (loan * rules.mortgageInsurance.annualRate) / 12 : 0;
    const housing = monthlyPrincipalAndInterest(loan, q, years, rules) + (price * rules.taxRate) / 12 + rules.otherMonthlyHousing + pmi;
    return housing <= rules.ratios.housing * monthlyIncome && housing + input.monthlyDebts <= rules.ratios.total * monthlyIncome;
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
export function affordabilityRange(input: AffordabilityInput, rules: FinanceRules = market.finance) {
  return {
    low: maxPrice(input, input.ratePercent + 0.5, rules),
    mid: maxPrice(input, input.ratePercent, rules),
    high: maxPrice(input, Math.max(0, input.ratePercent - 0.5), rules),
  };
}
