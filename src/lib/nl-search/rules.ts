import type { PropertyType } from "@/db/schema/listings";
import type { SearchParamsInput } from "@/types/search";

// Rule based natural language parser (docs/05 Phase 6 task 2). It is the offline provider and
// the fallback when the LLM provider fails. Pure, so the fixture cases run as unit tests.

export type Place = { name: string; slug: string };
export type ParseContext = { cities: readonly Place[]; neighborhoods?: readonly (Place & { citySlug: string })[]; now?: Date };

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const SQM_TO_SQFT = 10.7639;

const TYPE_PATTERNS: [RegExp, PropertyType][] = [
  [/\b(?:semi[\s-]?detached|semis?)\b/, "semi"],
  [/\b(?:town\s?houses?|town\s?homes?|row\s?houses?)\b/, "townhouse"],
  [/\b(?:condos?|condominiums?|apartments?|apts?|lofts?)\b/, "condo"],
  [/\b(?:duplex|triplex|fourplex|multi[\s-]?(?:unit|family|plex))\b/, "multi"],
  [/\b(?:vacant land|land|lots?)\b/, "land"],
  [/\b(?:detached|single[\s-]family|houses?|bungalows?)\b/, "detached"],
];

const AMENITIES = [
  "finished basement", "walkout", "basement", "balcony", "fireplace", "pool", "backyard", "garden", "terrace", "rooftop",
  "gym", "concierge", "waterfront", "lake view", "hardwood", "renovated", "den", "home office", "ev charger", "central air",
];

// A number followed by beds, baths or an area unit is not a price.
const MONEY = String.raw`\$?\s*(\d+(?:\.\d+)?)\s*(k|m|mil|million|thousand)?\b(?!\s*\+?\s*(?:bed|bd|br|bath|ba\b|sq|square|m2|m²))`;

function money(num: string, suffix: string | undefined, type: "sale" | "rent"): number {
  let n = Number(num);
  const s = suffix?.toLowerCase();
  if (s === "k" || s === "thousand") n *= 1_000;
  else if (s === "m" || s === "mil" || s === "million") n *= 1_000_000;
  // "under 900" for a home for sale means 900 thousand.
  else if (type === "sale" && n < 10_000) n *= 1_000;
  return Math.round(n);
}

function count(token: string): number {
  return WORD_NUMBERS[token] ?? Number(token);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseQueryRules(input: string, ctx: ParseContext): SearchParamsInput {
  // Drop thousands separators and hyphens between words so patterns stay simple.
  let text = ` ${input.toLowerCase().replace(/(\d),(?=\d{3}\b)/g, "$1").replace(/\s+/g, " ")} `;
  const out: SearchParamsInput = {};

  const rent = /\b(?:for rent|to rent|rent|rentals?|renting|lease|leasing|per month|a month|\/mo|monthly)\b/.test(text);
  const type = rent ? "rent" : "sale";
  if (rent) out.type = "rent";
  if (/\bsold\b/.test(text)) out.status = ["sold"];

  // Places first, longest names first, so "North York" wins over "York".
  const hoods = [...(ctx.neighborhoods ?? [])].sort((a, b) => b.name.length - a.name.length);
  for (const h of hoods) {
    if (new RegExp(`\\b${escapeRe(h.name.toLowerCase())}\\b`).test(text)) {
      out.city = h.citySlug;
      out.neighborhood = h.slug;
      text = text.replace(new RegExp(`\\b${escapeRe(h.name.toLowerCase())}\\b`), " ");
      break;
    }
  }
  if (!out.city) {
    for (const c of [...ctx.cities].sort((a, b) => b.name.length - a.name.length)) {
      if (new RegExp(`\\b${escapeRe(c.name.toLowerCase())}\\b`).test(text)) {
        out.city = c.slug;
        break;
      }
    }
  }

  // Area before price, so "over 2000 sq ft" is not read as a price.
  const area = text.match(/\b(over|above|at least|more than|min(?:imum)?|under|below|less than|max(?:imum)?|up to)?\s*(\d+)\s*(sq\.?\s?ft|square feet|sqft|sf|m2|m²|sq\.?\s?m|square met(?:er|re)s)\b/);
  if (area) {
    const metric = /m2|m²|sq\.?\s?m|met/.test(area[3]);
    const sqft = Math.round(Number(area[2]) * (metric ? SQM_TO_SQFT : 1));
    if (area[1] && /under|below|less|max|up to/.test(area[1])) out.sqftMax = sqft;
    else out.sqftMin = sqft;
    text = text.replace(area[0], " ");
  }

  const year = text.match(/\bbuilt (?:after|since|in or after|from)\s*(\d{4})\b/);
  if (year) {
    out.yearBuiltMin = Number(year[1]);
    text = text.replace(year[0], " ");
  } else if (/\bnew (?:construction|builds?)\b/.test(text)) {
    out.yearBuiltMin = (ctx.now ?? new Date()).getFullYear() - 2;
  }

  const between = text.match(new RegExp(`\\bbetween\\s+${MONEY}\\s+(?:and|to)\\s+${MONEY}`));
  if (between) {
    out.priceMin = money(between[1], between[2], type);
    out.priceMax = money(between[3], between[4], type);
    text = text.replace(between[0], " ");
  }
  const max = text.match(new RegExp(`\\b(?:under|below|less than|max(?:imum)?|up to|no more than|at most|cheaper than)\\s+${MONEY}`));
  if (max) out.priceMax = money(max[1], max[2], type);
  const min = text.match(new RegExp(`\\b(?:over|above|more than|at least|min(?:imum)?|starting at|from)\\s+${MONEY}`));
  if (min) out.priceMin = money(min[1], min[2], type);

  const beds = text.match(/\b(\d+|one|two|three|four|five|six)\s*\+?\s*(?:bed(?:room)?s?|bd|br)\b/);
  if (beds) out.bedsMin = count(beds[1]);
  else if (/\bstudios?\b/.test(text)) out.bedsMin = 0;
  const baths = text.match(/\b(\d+(?:\.5)?|one|two|three|four)\s*\+?\s*(?:bath(?:room)?s?|ba)\b/);
  if (baths) out.bathsMin = count(baths[1]);

  const types = new Set<PropertyType>();
  for (const [re, t] of TYPE_PATTERNS) {
    if (re.test(text)) {
      types.add(t);
      text = text.replace(re, " ");
    }
  }
  if (types.size) out.propertyTypes = [...types];

  if (/\b(?:pets?|dogs?|cats?)\b/.test(text) && !/\bno pets\b/.test(text)) out.pets = true;
  if (/\bfurnished\b/.test(text) && !/\bunfurnished\b/.test(text)) out.furnished = true;
  if (/\b(?:in[\s-]?suite laundry|ensuite laundry|laundry|washer)\b/.test(text)) out.laundry = true;
  if (/\b(?:parking|garage|driveway)\b/.test(text)) out.parking = true;
  if (!rent) {
    delete out.pets;
    delete out.furnished;
    delete out.laundry;
  }

  if (/\b(?:listed|new)\s+today\b/.test(text)) out.daysOnMarketMax = 1;
  else if (/\b(?:listed|new)\s+this week\b|\bnew listings?\b/.test(text)) out.daysOnMarketMax = 7;

  if (/\b(?:cheapest|lowest price|least expensive)\b/.test(text)) out.sort = "price_asc";
  else if (/\b(?:most expensive|highest price|priciest)\b/.test(text)) out.sort = "price_desc";
  else if (/\b(?:biggest|largest)\b/.test(text)) out.sort = "sqft_desc";

  const keywords = AMENITIES.filter((a) => text.includes(a)).filter((a, _, all) => !all.some((b) => b !== a && b.includes(a)));
  if (keywords.length) out.keywords = keywords.join(" ");
  return out;
}
