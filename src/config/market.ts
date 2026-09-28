import { brand } from "./brand";

// Everything that changes with the market in the CLAUDE.md brand config: locale, region code,
// timezone and property tax. Client safe.

export type FinanceRules = {
  /** Property tax as a share of price per year, for demo listings. */
  taxRate: number;
};

const CANADA: FinanceRules = { taxRate: 0.007 };

// California: about 1% under Proposition 13 plus local assessments.
const UNITED_STATES: FinanceRules = { taxRate: 0.0115 };

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
