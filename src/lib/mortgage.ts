import { z } from "zod";

// Monthly cost calculator (docs/01 B2, LDP section 10). Canadian fixed rate mortgages compound
// semi annually. Outputs are estimates shown as a range with a confidence label (CLAUDE.md rule 8).

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

export const DEFAULT_RATE_PERCENT = 4.79;
export const RATE_SPREAD = 0.5;

/** Mortgage default insurance premium on the loan amount for down payments under 20%. */
export function insurancePremiumRate(downPercent: number): number {
  if (downPercent >= 20) return 0;
  if (downPercent >= 15) return 0.028;
  if (downPercent >= 10) return 0.031;
  return 0.04;
}

/** Minimum down payment in Canada: 5% of the first $500K, 10% of the rest, 20% at $1.5M and above. */
export function minimumDownPayment(price: number): number {
  if (price >= 1_500_000) return price * 0.2;
  if (price <= 500_000) return price * 0.05;
  return 25_000 + (price - 500_000) * 0.1;
}

export function monthlyPrincipalAndInterest(principal: number, ratePercent: number, years: number): number {
  if (principal <= 0) return 0;
  const n = years * 12;
  if (ratePercent === 0) return principal / n;
  const monthly = Math.pow(1 + ratePercent / 100 / 2, 1 / 6) - 1;
  return (principal * monthly) / (1 - Math.pow(1 + monthly, -n));
}

export type MonthlyCost = {
  principalAndInterest: number;
  propertyTax: number;
  insurance: number;
  hoa: number;
  total: number;
  loanAmount: number;
  insurancePremium: number;
  belowMinimumDown: boolean;
};

export function monthlyCost(input: MortgageInputs, ratePercent = input.ratePercent): MonthlyCost {
  const down = (input.price * input.downPaymentPercent) / 100;
  const base = Math.max(0, input.price - down);
  const premium = input.price < 1_500_000 ? base * insurancePremiumRate(input.downPaymentPercent) : 0;
  const loanAmount = base + premium;
  const pi = monthlyPrincipalAndInterest(loanAmount, ratePercent, input.amortizationYears);
  const propertyTax = input.propertyTaxAnnual / 12;
  const total = pi + propertyTax + input.insuranceMonthly + input.hoaMonthly;
  return {
    principalAndInterest: pi,
    propertyTax,
    insurance: input.insuranceMonthly,
    hoa: input.hoaMonthly,
    total,
    loanAmount,
    insurancePremium: premium,
    belowMinimumDown: down + 0.5 < minimumDownPayment(input.price),
  };
}

/** Low and high monthly totals for rates half a point either side of the input rate. */
export function monthlyCostRange(input: MortgageInputs): { low: number; mid: number; high: number } {
  return {
    low: monthlyCost(input, Math.max(0, input.ratePercent - RATE_SPREAD)).total,
    mid: monthlyCost(input).total,
    high: monthlyCost(input, input.ratePercent + RATE_SPREAD).total,
  };
}
