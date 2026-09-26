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

// California example market. Values are plausible 2026 figures for the demo, not market data.
export const CITY_DEFS: CityDef[] = [
  {
    name: "Los Angeles",
    slug: "los-angeles",
    boundary: [
      [-118.5, 34.03], [-118.45, 34.1], [-118.35, 34.13], [-118.25, 34.16], [-118.17, 34.15], [-118.16, 34.08],
      [-118.2, 33.99], [-118.28, 33.93], [-118.37, 33.93], [-118.43, 33.96], [-118.5, 34.03],
    ],
    center: [-118.2437, 34.0522],
    share: 0.38,
    ppsf: 780,
    annualGrowth: 0.035,
    neighborhoods: 20,
    postalAreas: ["90004", "90005", "90006", "90012", "90013", "90019", "90020", "90024", "90025", "90026", "90027", "90028", "90034", "90035", "90036", "90039", "90046", "90048", "90064", "90066"],
    typeMix: { condo: 28, detached: 50, townhouse: 12, multi: 8, semi: 1, land: 0.1 },
    timezone: "America/Los_Angeles",
  },
  {
    name: "San Diego",
    slug: "san-diego",
    boundary: [
      [-117.25, 32.8], [-117.2, 32.87], [-117.1, 32.9], [-117.03, 32.87], [-117.02, 32.75], [-117.05, 32.7],
      [-117.12, 32.7], [-117.16, 32.72], [-117.2, 32.74], [-117.25, 32.8],
    ],
    center: [-117.1611, 32.7157],
    share: 0.2,
    ppsf: 720,
    annualGrowth: 0.032,
    neighborhoods: 16,
    postalAreas: ["92101", "92102", "92103", "92104", "92105", "92106", "92107", "92108", "92109", "92110", "92111", "92115", "92116", "92117", "92120", "92122"],
    typeMix: { condo: 30, detached: 52, townhouse: 14, multi: 3, semi: 1, land: 0.1 },
    timezone: "America/Los_Angeles",
  },
  {
    name: "San Jose",
    slug: "san-jose",
    boundary: [
      [-121.98, 37.3], [-121.95, 37.38], [-121.87, 37.42], [-121.8, 37.39], [-121.76, 37.32], [-121.8, 37.25],
      [-121.88, 37.22], [-121.95, 37.25], [-121.98, 37.3],
    ],
    center: [-121.8863, 37.3382],
    share: 0.15,
    ppsf: 900,
    annualGrowth: 0.03,
    neighborhoods: 14,
    postalAreas: ["95110", "95112", "95116", "95117", "95118", "95120", "95121", "95122", "95123", "95124", "95125", "95126", "95127", "95128", "95129", "95130"],
    typeMix: { condo: 18, detached: 60, townhouse: 18, multi: 3, semi: 1, land: 0.1 },
    timezone: "America/Los_Angeles",
  },
  {
    name: "San Francisco",
    slug: "san-francisco",
    boundary: [
      [-122.505, 37.71], [-122.51, 37.78], [-122.48, 37.79], [-122.45, 37.805], [-122.4, 37.807], [-122.385, 37.79],
      [-122.39, 37.75], [-122.385, 37.71], [-122.505, 37.71],
    ],
    center: [-122.4194, 37.7749],
    share: 0.12,
    ppsf: 1050,
    annualGrowth: 0.028,
    neighborhoods: 14,
    postalAreas: ["94102", "94103", "94107", "94109", "94110", "94112", "94114", "94115", "94116", "94117", "94118", "94121", "94122", "94123", "94124", "94131", "94133"],
    typeMix: { condo: 42, detached: 30, townhouse: 6, multi: 20, semi: 2, land: 0.1 },
    timezone: "America/Los_Angeles",
  },
  {
    name: "Sacramento",
    slug: "sacramento",
    boundary: [
      [-121.56, 38.5], [-121.56, 38.6], [-121.52, 38.66], [-121.43, 38.66], [-121.38, 38.6], [-121.4, 38.51],
      [-121.47, 38.47], [-121.56, 38.5],
    ],
    center: [-121.4944, 38.5816],
    share: 0.15,
    ppsf: 370,
    annualGrowth: 0.025,
    neighborhoods: 12,
    postalAreas: ["95811", "95814", "95815", "95816", "95817", "95818", "95819", "95820", "95821", "95822", "95823", "95825", "95831", "95834", "95838"],
    typeMix: { condo: 10, detached: 72, townhouse: 10, multi: 6, semi: 1, land: 0.1 },
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
