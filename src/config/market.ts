import { brand } from "./brand";

// Everything that changes with the market in the CLAUDE.md brand config: locale, region code,
// timezone and the mortgage rules lenders apply there. Client safe.

export type FinanceRules = {
  /** How the quoted annual rate compounds: Canadian fixed rates semi annually, US rates monthly. */
  compounding: "semiannual" | "monthly";
  defaultRatePercent: number;
  defaultAmortizationYears: number;
  /** Minimum down payment in dollars for a price. */
  minimumDownPayment: (price: number) => number;
  /**
   * Mortgage insurance under 20% down. Canada: a one time premium added to the loan (share of the
   * loan). US: private mortgage insurance paid monthly (annual share of the loan).
   */
  mortgageInsurance: { kind: "premium_on_loan"; rate: (downPercent: number, price: number) => number } | { kind: "monthly_pmi"; annualRate: number };
  /** Debt ratios lenders use: housing costs, and housing plus other debts, as shares of gross income. */
  ratios: { housing: number; total: number };
  /** Rate the borrower must qualify at. */
  qualifyingRate: (rate: number) => number;
  qualifyingNote: string;
  /** Property tax as a share of price per year, and other monthly housing costs assumed by lenders. */
  taxRate: number;
  otherMonthlyHousing: number;
};

const CANADA: FinanceRules = {
  compounding: "semiannual",
  defaultRatePercent: 4.79,
  defaultAmortizationYears: 25,
  // 5% of the first $500K, 10% of the rest, 20% at $1.5M and above.
  minimumDownPayment: (price) => (price >= 1_500_000 ? price * 0.2 : price <= 500_000 ? price * 0.05 : 25_000 + (price - 500_000) * 0.1),
  mortgageInsurance: {
    kind: "premium_on_loan",
    rate: (down, price) => (down >= 20 || price >= 1_500_000 ? 0 : down >= 15 ? 0.028 : down >= 10 ? 0.031 : 0.04),
  },
  ratios: { housing: 0.39, total: 0.44 },
  qualifyingRate: (rate) => Math.max(rate + 2, 5.25),
  qualifyingNote: "Lenders qualify you at the stress test rate, the greater of your rate plus 2 points and 5.25%.",
  taxRate: 0.007,
  otherMonthlyHousing: 100,
};

const UNITED_STATES: FinanceRules = {
  compounding: "monthly",
  defaultRatePercent: 6.25,
  defaultAmortizationYears: 30,
  // Conventional loans typically allow 3% down; many buyers put down more.
  minimumDownPayment: (price) => price * 0.03,
  mortgageInsurance: { kind: "monthly_pmi", annualRate: 0.006 },
  // The common 28/36 guideline: housing within 28% of gross income, all debts within 36%.
  ratios: { housing: 0.28, total: 0.36 },
  qualifyingRate: (rate) => rate,
  qualifyingNote: "Lenders typically keep housing costs within 28% of gross income and all debts within 36%.",
  // California: about 1% under Proposition 13 plus local assessments.
  taxRate: 0.0115,
  otherMonthlyHousing: 125,
};

type MarketProfile = {
  locale: string;
  countryName: string;
  regionCode: string;
  timezone: string;
  finance: FinanceRules;
  /** "ZIP code" or "postal code". */
  postalLabel: string;
  /** Example addresses for form placeholders and help text, in the first configured city. */
  exampleAddress: string;
  exampleUnitAddress: string;
};

const REGION_CODES: Record<string, string> = { Ontario: "ON", "British Columbia": "BC", Quebec: "QC", Alberta: "AB", California: "CA", "New York": "NY", Texas: "TX", Florida: "FL", Washington: "WA" };
const REGION_TIMEZONES: Record<string, string> = { Ontario: "America/Toronto", Quebec: "America/Toronto", "British Columbia": "America/Vancouver", Alberta: "America/Edmonton", California: "America/Los_Angeles", Washington: "America/Los_Angeles", "New York": "America/New_York", Florida: "America/New_York", Texas: "America/Chicago" };

function profileFor(country: "CA" | "US", region: string): MarketProfile {
  return {
    locale: country === "US" ? "en-US" : "en-CA",
    countryName: country === "US" ? "United States" : "Canada",
    regionCode: REGION_CODES[region] ?? region.slice(0, 2).toUpperCase(),
    timezone: REGION_TIMEZONES[region] ?? (country === "US" ? "America/New_York" : "America/Toronto"),
    finance: country === "US" ? UNITED_STATES : CANADA,
    postalLabel: country === "US" ? "ZIP code" : "postal code",
    exampleAddress: `12 Maple Ave, ${brand.market.cities[0].name}`,
    exampleUnitAddress: `Unit 1204, 88 Harbor St, ${brand.market.cities[0].name}`,
  };
}

export const market = profileFor(brand.market.country, brand.market.region);

export function financeRulesFor(country: "CA" | "US"): FinanceRules {
  return country === "US" ? UNITED_STATES : CANADA;
}
