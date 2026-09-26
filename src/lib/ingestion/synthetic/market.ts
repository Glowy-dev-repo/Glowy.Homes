import type { PropertyType } from "@/db/schema/listings";

// Synthetic market definitions for the configured cities. Boundaries are simplified
// approximations drawn for this project (no third party data); values are plausible 2026
// Ontario figures, not market data.

export type CityDef = {
  name: string;
  slug: string;
  /** [lng, lat] ring, first point repeated last. */
  boundary: [number, number][];
  center: [number, number];
  /** Share of the 50,000 synthetic properties. */
  share: number;
  /** Base value per sqft in CAD. */
  ppsf: number;
  /** Annual market growth used for the hidden market index. */
  annualGrowth: number;
  neighborhoods: number;
  fsa: string[];
  typeMix: Partial<Record<PropertyType, number>>;
  timezone: string;
};

export const CITY_DEFS: CityDef[] = [
  {
    name: "Toronto",
    slug: "toronto",
    boundary: [
      [-79.545, 43.587], [-79.58, 43.6], [-79.639, 43.625], [-79.639, 43.75], [-79.42, 43.793],
      [-79.17, 43.855], [-79.117, 43.822], [-79.155, 43.76], [-79.25, 43.695], [-79.32, 43.66],
      [-79.38, 43.64], [-79.47, 43.63], [-79.5, 43.61], [-79.545, 43.587],
    ],
    center: [-79.387, 43.653],
    share: 0.4,
    ppsf: 860,
    annualGrowth: 0.035,
    neighborhoods: 20,
    fsa: ["M4C", "M4E", "M4K", "M4L", "M4M", "M5A", "M5V", "M6G", "M6H", "M6J", "M6K", "M6P", "M6R", "M8V", "M8W", "M9A", "M9B", "M1B", "M1E", "M1K", "M2N", "M3H", "M4R", "M5R"],
    typeMix: { condo: 44, detached: 25, semi: 12, townhouse: 13, multi: 5.5, land: 0.5 },
    timezone: "America/Toronto",
  },
  {
    name: "Mississauga",
    slug: "mississauga",
    boundary: [
      [-79.545, 43.587], [-79.58, 43.6], [-79.639, 43.625], [-79.639, 43.735], [-79.7, 43.74],
      [-79.79, 43.67], [-79.81, 43.63], [-79.7, 43.52], [-79.63, 43.49], [-79.58, 43.52], [-79.545, 43.587],
    ],
    center: [-79.644, 43.589],
    share: 0.17,
    ppsf: 690,
    annualGrowth: 0.03,
    neighborhoods: 16,
    fsa: ["L4T", "L4W", "L4X", "L4Y", "L4Z", "L5A", "L5B", "L5C", "L5E", "L5G", "L5H", "L5J", "L5K", "L5L", "L5M", "L5N", "L5R", "L5V", "L5W"],
    typeMix: { condo: 30, detached: 35, semi: 15, townhouse: 18, multi: 1.5, land: 0.5 },
    timezone: "America/Toronto",
  },
  {
    name: "Ottawa",
    slug: "ottawa",
    boundary: [
      [-75.93, 45.35], [-75.85, 45.39], [-75.76, 45.41], [-75.7, 45.43], [-75.66, 45.45], [-75.6, 45.47],
      [-75.52, 45.47], [-75.5, 45.42], [-75.55, 45.33], [-75.62, 45.26], [-75.72, 45.25], [-75.8, 45.27],
      [-75.9, 45.28], [-75.95, 45.31], [-75.93, 45.35],
    ],
    center: [-75.697, 45.421],
    share: 0.22,
    ppsf: 480,
    annualGrowth: 0.028,
    neighborhoods: 18,
    fsa: ["K1G", "K1H", "K1K", "K1L", "K1M", "K1N", "K1R", "K1S", "K1V", "K1Y", "K1Z", "K2A", "K2B", "K2C", "K2E", "K2G", "K2H", "K2J"],
    typeMix: { condo: 22, detached: 40, semi: 10, townhouse: 25, multi: 2.5, land: 0.5 },
    timezone: "America/Toronto",
  },
  {
    name: "Hamilton",
    slug: "hamilton",
    boundary: [
      [-79.99, 43.27], [-79.94, 43.29], [-79.87, 43.28], [-79.8, 43.27], [-79.73, 43.24], [-79.68, 43.23],
      [-79.7, 43.18], [-79.8, 43.16], [-79.9, 43.17], [-80.0, 43.2], [-80.03, 43.24], [-79.99, 43.27],
    ],
    center: [-79.871, 43.256],
    share: 0.12,
    ppsf: 500,
    annualGrowth: 0.025,
    neighborhoods: 14,
    fsa: ["L8E", "L8G", "L8H", "L8K", "L8L", "L8M", "L8N", "L8P", "L8R", "L8S", "L8T", "L8V", "L8W", "L9A", "L9B", "L9C", "L9G", "L9H", "L9K"],
    typeMix: { condo: 15, detached: 55, semi: 10, townhouse: 15, multi: 4.5, land: 0.5 },
    timezone: "America/Toronto",
  },
  {
    name: "London",
    slug: "london",
    boundary: [
      [-81.36, 42.95], [-81.33, 43.02], [-81.27, 43.06], [-81.19, 43.06], [-81.14, 43.02], [-81.14, 42.94],
      [-81.19, 42.9], [-81.28, 42.89], [-81.35, 42.91], [-81.36, 42.95],
    ],
    center: [-81.245, 42.985],
    share: 0.09,
    ppsf: 420,
    annualGrowth: 0.022,
    neighborhoods: 12,
    fsa: ["N5V", "N5W", "N5X", "N5Y", "N5Z", "N6A", "N6B", "N6C", "N6E", "N6G", "N6H", "N6J", "N6K", "N6L", "N6M", "N6P"],
    typeMix: { condo: 18, detached: 55, semi: 7, townhouse: 17, multi: 2.5, land: 0.5 },
    timezone: "America/Toronto",
  },
];

export const NEIGHBORHOOD_PREFIXES = [
  "Maple", "Cedar", "Birch", "Willow", "Oak", "Pine", "Elm", "Aspen", "Harbour", "Lake", "River", "Stone",
  "Mill", "Orchard", "Meadow", "Fox", "Heron", "Crystal", "Summer", "Kings", "Queens", "Garden", "Bridge",
  "Forest", "Spring", "Silver", "Ash", "Cherry", "Clover", "Juniper", "Linden", "Hawthorn", "Sparrow", "Beacon",
];

export const NEIGHBORHOOD_SUFFIXES = [
  "Heights", "Park", "Village", "Grove", "Hill", "Glen", "Gardens", "Point", "Crossing", "Ridge", "Commons",
  "Landing", "Terrace", "Woods", "Creek", "Estates", "Square", "Mills",
];

export const STREET_NAMES = [
  "Alder", "Balsam", "Beech", "Bluebell", "Bramble", "Briar", "Brook", "Buttonwood", "Chestnut", "Clearview",
  "Coral", "Cottonwood", "Crescent", "Daisy", "Dogwood", "Driftwood", "Fairview", "Fern", "Fieldstone",
  "Foxglove", "Glenwood", "Goldfinch", "Granite", "Greenbriar", "Hazel", "Heather", "Hemlock", "Highland",
  "Holly", "Ironwood", "Ivy", "Jasmine", "Kestrel", "Lakeview", "Larch", "Laurel", "Lilac", "Magnolia",
  "Mapleleaf", "Marigold", "Meadowlark", "Millstone", "Mulberry", "Northwood", "Oakridge", "Parkside",
  "Pebble", "Poplar", "Primrose", "Quarry", "Raven", "Redwood", "Ridgeview", "Riverside", "Robin", "Rosewood",
  "Sage", "Sandalwood", "Seaton", "Shoreline", "Silverbirch", "Skyline", "Snowberry", "Spruce", "Starling",
  "Stonegate", "Sumac", "Sunset", "Sycamore", "Tamarack", "Thistle", "Timber", "Trillium", "Tulip", "Valley",
  "Violet", "Walnut", "Westwood", "Wheatfield", "Whitebirch", "Wildflower", "Windermere", "Wren", "Yew",
];

export const STREET_SUFFIXES = ["Ave", "St", "Rd", "Cres", "Dr", "Blvd", "Crt", "Lane", "Way", "Pl"];

export const BROKERAGES = [
  "Northlight Realty", "Harbourfront Homes Brokerage", "Cedarline Real Estate", "Keystone Property Group",
  "Bluewater Realty", "Summit Lane Brokerage", "Oakmere Realty", "Trillium Key Realty",
];
