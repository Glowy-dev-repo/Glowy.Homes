import type { PropertyType } from "@/db/schema/listings";

// Synthetic market definitions for the configured cities. Boundaries are simplified
// approximations drawn for this project (no third party data).

export type CityDef = {
  name: string;
  slug: string;
  /** [lng, lat] ring, first point repeated last. */
  boundary: [number, number][];
  center: [number, number];
  /** Share of the 50,000 synthetic properties. */
  share: number;
  /** Base value per sqft in the market currency. */
  ppsf: number;
  /** Annual market growth used for the hidden market index. */
  annualGrowth: number;
  neighborhoods: number;
  /** ZIP codes (US) or forward sortation areas (Canada) handed out to neighborhoods in turn. */
  postalAreas: string[];
  typeMix: Partial<Record<PropertyType, number>>;
  timezone: string;
};

// Conejo Valley, Simi Valley and Moorpark: the area the CSMAR MLS covers. Boundaries are simplified
// shapes drawn for this project and kept apart from each other; values are plausible 2026 figures for
// the demo, not market data.
const SUBURBAN_MIX: Partial<Record<PropertyType, number>> = { condo: 12, detached: 70, townhouse: 14, multi: 2, semi: 1, land: 0.2 };

export const CITY_DEFS: CityDef[] = [
  {
    name: "Thousand Oaks",
    slug: "thousand-oaks",
    boundary: [
      [-118.89, 34.16], [-118.89, 34.21], [-118.85, 34.225], [-118.8, 34.215], [-118.78, 34.19], [-118.79, 34.16],
      [-118.84, 34.155], [-118.89, 34.16],
    ],
    center: [-118.8376, 34.1806],
    share: 0.3,
    ppsf: 640,
    annualGrowth: 0.032,
    neighborhoods: 14,
    postalAreas: ["91360", "91362"],
    typeMix: SUBURBAN_MIX,
    timezone: "America/Los_Angeles",
  },
  {
    name: "Simi Valley",
    slug: "simi-valley",
    boundary: [
      [-118.83, 34.27], [-118.8, 34.3], [-118.72, 34.305], [-118.66, 34.29], [-118.66, 34.255], [-118.72, 34.245],
      [-118.8, 34.25], [-118.83, 34.27],
    ],
    center: [-118.7815, 34.2694],
    share: 0.3,
    ppsf: 470,
    annualGrowth: 0.03,
    neighborhoods: 14,
    postalAreas: ["93063", "93065"],
    typeMix: { condo: 10, detached: 72, townhouse: 13, multi: 3, semi: 1, land: 0.2 },
    timezone: "America/Los_Angeles",
  },
  {
    name: "Newbury Park",
    slug: "newbury-park",
    boundary: [
      [-119.0, 34.15], [-118.99, 34.2], [-118.94, 34.215], [-118.89, 34.21], [-118.89, 34.16], [-118.93, 34.145],
      [-119.0, 34.15],
    ],
    center: [-118.9437, 34.1842],
    share: 0.16,
    ppsf: 600,
    annualGrowth: 0.031,
    neighborhoods: 8,
    postalAreas: ["91320"],
    typeMix: SUBURBAN_MIX,
    timezone: "America/Los_Angeles",
  },
  {
    name: "Moorpark",
    slug: "moorpark",
    boundary: [
      [-118.93, 34.28], [-118.91, 34.3], [-118.86, 34.305], [-118.84, 34.29], [-118.85, 34.265], [-118.9, 34.26],
      [-118.93, 34.28],
    ],
    center: [-118.882, 34.2856],
    share: 0.14,
    ppsf: 520,
    annualGrowth: 0.03,
    neighborhoods: 8,
    postalAreas: ["93021"],
    typeMix: { condo: 10, detached: 72, townhouse: 14, multi: 2, semi: 1, land: 0.3 },
    timezone: "America/Los_Angeles",
  },
  {
    name: "Westlake Village",
    slug: "westlake-village",
    boundary: [
      [-118.84, 34.155], [-118.79, 34.16], [-118.77, 34.15], [-118.77, 34.13], [-118.8, 34.125], [-118.84, 34.13],
      [-118.84, 34.155],
    ],
    center: [-118.8054, 34.1458],
    share: 0.1,
    ppsf: 760,
    annualGrowth: 0.033,
    neighborhoods: 6,
    postalAreas: ["91361", "91362"],
    typeMix: { condo: 18, detached: 62, townhouse: 18, multi: 1, semi: 1, land: 0.1 },
    timezone: "America/Los_Angeles",
  },
];

export const NEIGHBORHOOD_PREFIXES = [
  "Maple", "Cedar", "Birch", "Willow", "Oak", "Pine", "Elm", "Aspen", "Harbor", "Lake", "River", "Stone",
  "Mill", "Orchard", "Meadow", "Fox", "Heron", "Crystal", "Summer", "Kings", "Queens", "Garden", "Bridge",
  "Forest", "Spring", "Silver", "Ash", "Cherry", "Clover", "Juniper", "Linden", "Hawthorn", "Sparrow", "Beacon",
];

export const NEIGHBORHOOD_SUFFIXES = [
  "Heights", "Park", "Village", "Grove", "Hill", "Glen", "Gardens", "Point", "Crossing", "Ridge", "Commons",
  "Landing", "Terrace", "Woods", "Creek", "Estates", "Square", "Mills",
];

export const STREET_NAMES = [
  "Alder", "Bayview", "Beech", "Bluebell", "Bramble", "Briar", "Brook", "Buttonwood", "Chestnut", "Clearview",
  "Coral", "Cottonwood", "Crescent", "Daisy", "Dogwood", "Driftwood", "Fairview", "Fern", "Fieldstone",
  "Foxglove", "Glenwood", "Goldfinch", "Granite", "Greenbriar", "Hazel", "Heather", "Hemlock", "Highland",
  "Holly", "Ironwood", "Ivy", "Jasmine", "Kestrel", "Lakeview", "Larch", "Laurel", "Lilac", "Magnolia",
  "Manzanita", "Marigold", "Meadowlark", "Millstone", "Mulberry", "Northwood", "Oakridge", "Parkside",
  "Pebble", "Poplar", "Primrose", "Quarry", "Raven", "Redwood", "Ridgeview", "Riverside", "Robin", "Rosewood",
  "Sage", "Sandalwood", "Sequoia", "Shoreline", "Silverbirch", "Skyline", "Snowberry", "Spruce", "Starling",
  "Stonegate", "Sumac", "Sunset", "Sycamore", "Tamarack", "Thistle", "Timber", "Toyon", "Tulip", "Valley",
  "Violet", "Walnut", "Westwood", "Wheatfield", "Whitebirch", "Wildflower", "Windermere", "Wren", "Yew",
];

export const STREET_SUFFIXES = ["Ave", "St", "Rd", "Dr", "Blvd", "Ct", "Ln", "Way", "Pl", "Ter"];

export const BROKERAGES = [
  "Northlight Realty", "Harborfront Homes", "Cedarline Real Estate", "Keystone Property Group",
  "Bluewater Realty", "Summit Lane Properties", "Oakmere Realty", "Golden Poppy Realty",
];
