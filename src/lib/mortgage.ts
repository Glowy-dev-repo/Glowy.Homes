import { z } from "zod";
import { market, type FinanceRules } from "@/config/market";

// Monthly cost calculator (docs/01 B2, LDP section 10). The lending rules come from the market
// (src/config/market.ts): Canadian fixed rates compound semi annually with a default insurance
// premium added to the loan; US rates compound monthly with private mortgage insurance paid
// monthly. Outputs are estimates shown as a range with a confidence label (CLAUDE.md rule 8).

export const MortgageInputs = z.object({
  price: z.number().positive().max(100_000_000),
  downPaymentPercent: z.number().min(0).max(100),
  ratePercent: z.number().min(0).max(25),
  amortizationYears: z.number().int().min(5).max(30),
  propertyTaxAnnual: z.number().min(0),
  insuranceMonthly: z.number().min(0),
  hoaMonthly: z.number().min(0),
});
export type MortgageInputs = z.infer<typeof MortgageInputs>;

export const DEFAULT_RATE_PERCENT = market.finance.defaultRatePercent;
export const DEFAULT_AMORTIZATION_YEARS = market.finance.defaultAmortizationYears;
export const RATE_SPREAD = 0.5;

export function minimumDownPayment(price: number, rules: FinanceRules = market.finance): number {
  return rules.minimumDownPayment(price);
}

export function monthlyPrincipalAndInterest(principal: number, ratePercent: number, years: number, rules: FinanceRules = market.finance): number {
  if (principal <= 0) return 0;
  const n = years * 12;
  if (ratePercent === 0) return principal / n;
  const monthly = rules.compounding === "semiannual" ? Math.pow(1 + ratePercent / 100 / 2, 1 / 6) - 1 : ratePercent / 100 / 12;
  return (principal * monthly) / (1 - Math.pow(1 + monthly, -n));
}

export type MonthlyCost = {
  principalAndInterest: number;
  propertyTax: number;
  insurance: number;
  hoa: number;
  /** US private mortgage insurance per month (0 at 20% down or more, and in Canada). */
  mortgageInsuranceMonthly: number;
  total: number;
  loanAmount: number;
  /** Canadian default insurance premium added to the loan (0 in the US). */
  insurancePremium: number;
  belowMinimumDown: boolean;
};

export function monthlyCost(input: MortgageInputs, ratePercent = input.ratePercent, rules: FinanceRules = market.finance): MonthlyCost {
  const down = (input.price * input.downPaymentPercent) / 100;
  const base = Math.max(0, input.price - down);
  const mi = rules.mortgageInsurance;
  const premium = mi.kind === "premium_on_loan" ? base * mi.rate(input.downPaymentPercent, input.price) : 0;
  const loanAmount = base + premium;
  const pmi = mi.kind === "monthly_pmi" && input.downPaymentPercent < 20 ? (loanAmount * mi.annualRate) / 12 : 0;
  const pi = monthlyPrincipalAndInterest(loanAmount, ratePercent, input.amortizationYears, rules);
  const propertyTax = input.propertyTaxAnnual / 12;
  const total = pi + propertyTax + input.insuranceMonthly + input.hoaMonthly + pmi;
  return {
    principalAndInterest: pi,
    propertyTax,
    insurance: input.insuranceMonthly,
    hoa: input.hoaMonthly,
    mortgageInsuranceMonthly: pmi,
    total,
    loanAmount,
    insurancePremium: premium,
    belowMinimumDown: down + 0.5 < rules.minimumDownPayment(input.price),
  };
}

/** Low and high monthly totals for rates half a point either side of the input rate. */
export function monthlyCostRange(input: MortgageInputs, rules: FinanceRules = market.finance): { low: number; mid: number; high: number } {
  return {
    low: monthlyCost(input, Math.max(0, input.ratePercent - RATE_SPREAD), rules).total,
    mid: monthlyCost(input, input.ratePercent, rules).total,
    high: monthlyCost(input, input.ratePercent + RATE_SPREAD, rules).total,
  };
}
