# 04 Design System

## 1. Principle

Zillow wins on information hierarchy, not decoration. A visitor should know the price, size, and where a home is within one second, and know what to do next within three. We copy the hierarchy and the workflow. We do not copy the look.

Style direction: calm, spacious, one accent color, typography carries hierarchy. Think Stripe's clarity, Linear's density, Apple's restraint. No gradients, no decorative illustrations, no more than one accent color on a screen.

## 2. Tokens

Defined in `src/config/brand.ts` and mapped to Tailwind theme.

```ts
export const tokens = {
  color: {
    accent: brand.brand_color,            // buttons, links, active states, map pins
    accentHover: "shade(accent, 10%)",
    neutral: brand.neutral_scale,         // zinc 50 to 950 for surfaces and text
    success: "#16A34A",                   // status badges only
    warning: "#D97706",
    danger: "#DC2626",
    surface: "neutral.0",
    surfaceRaised: "white with 1px neutral.200 border",
    text: "neutral.900",
    textMuted: "neutral.500",
  },
  radius: { sm: "6px", md: "10px", lg: "14px", pill: "999px" },
  shadow: { card: "0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)", raised: "0 8px 24px rgba(0,0,0,0.08)" },
  space: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80],
  type: {
    family: brand.font_sans,
    display: { size: 40, weight: 600, lineHeight: 1.1, tracking: -0.02 },
    h1: { size: 28, weight: 600, lineHeight: 1.2, tracking: -0.01 },
    h2: { size: 22, weight: 600, lineHeight: 1.25 },
    h3: { size: 17, weight: 600, lineHeight: 1.3 },
    body: { size: 15, weight: 400, lineHeight: 1.5 },
    small: { size: 13, weight: 400, lineHeight: 1.45 },
    label: { size: 12, weight: 500, lineHeight: 1.3, tracking: 0.02, transform: "uppercase" },
    price: { size: 24, weight: 700, lineHeight: 1.1, tabular: true },
  },
  breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280 },
  container: { max: 1280, gutter: 16, gutterLg: 32 },
};
```

Rules:
1. Prices always use tabular numerals and the currency from config.
2. Status uses color: green active, amber pending, neutral sold or leased, red withdrawn. Nowhere else uses these colors.
3. Accent appears on at most: primary button, links, active filter chips, map pins, focus rings.
4. Minimum tap target 44px on mobile.
5. Contrast at least 4.5:1 for text.

## 3. Core components

### ListingCard
Used in search results, similar homes, saved homes, alert emails.

```
+------------------------------------+
| [photo 3:2, blur placeholder]      |   heart icon top right, status badge top left
| [featured ribbon if is_featured]   |
+------------------------------------+
| $1,249,000                         |   price, bold, tabular
| 4 bd  3 ba  2,150 sqft             |   facts, muted
| 12 Maple Ave, Oakville             |   address, one line, truncate
| Listed 3 days ago · Brokerage Name |   small, muted (attribution required for MLS)
+------------------------------------+
```

Sizes: `default` (results grid), `compact` (map hover, email), `wide` (saved homes list). Whole card is a link. Heart is a separate button with `stopPropagation`.

### SearchBar
Single input with autocomplete dropdown grouped as Places, Addresses, Listing IDs. Enter with no selection runs a text search. Selecting a place navigates to its browse page. Selecting an address goes to the LDP or the property value page.

### FilterBar
Desktop: horizontal row of chips: For sale or rent toggle, Price (popover with dual slider and inputs), Beds, Baths, Home type (multi), More (drawer with everything else), Save search button. Mobile: one "Filters" button with count badge that opens a full screen sheet with the same controls and a sticky "Show 1,240 homes" apply button. Filter state is the URL. Changing a filter pushes a new URL and refetches.

### MapView
MapLibre with MapTiler light style, desaturated. Pins: small accent dots with price label on hover or when fewer than 60 results. Clusters: neutral circles with count. Selected listing: raised pin and a compact card popover. "Search as I move the map" toggle, on by default. Draw tool: pencil icon, freehand polygon, done button, clear. Map and list share one store; hovering a card highlights its pin and hovering a pin highlights its card.

### Search page layout
Desktop: filter bar full width under the header, then two columns: list left at 55% (grid of 2 cards), map right at 45% sticky to viewport height. Mobile: map by default with a bottom sheet list that can be pulled up, or a List and Map toggle in the filter bar. Result count and sort dropdown at the top of the list.

### Listing detail page layout
Desktop: gallery hero (one large photo left, four small right, "See all 32 photos" button), then two columns: content left at 62%, sticky sidebar right at 38% holding price, facts, primary actions, estimate card, agent card. Mobile: full width gallery carousel, then price block, then sticky bottom bar with price and "Request tour" and "Contact" buttons, then all sections stacked.

Section order is fixed in docs/01 section 4.2. Do not reorder.

### EstimateCard
```
Glowy Homes value range            label
$1,210,000                         price style
$1,160,000 to $1,265,000           small, muted
Confidence: High  [i]              small, tooltip explains
[12 month sparkline]
Rent estimate  $3,900/mo           small row
See comps and methodology ->       link
Automated estimate, not an appraisal.   small, muted, always present
```

### LeadForm (ContactAgent and TourScheduler)
Name, email, phone (optional), message prefilled "I'd like to know more about 12 Maple Ave", for tours: three date and time window pickers and an In person or Video toggle. Consent checkbox with plain language: "You agree to be contacted by a licensed professional about this home." Submit shows inline success with the assigned pro's name when routing completes within 5 seconds, otherwise "We'll match you with an agent shortly."

### PriceHistoryTable
Date, Event, Price, Change (percent, colored), Source. Newest first. Collapsed to 5 rows with "Show all".

### FactsGrid
Two column key value list on desktop, one column on mobile. Groups as expandable sections after the first eight facts.

### Pro components
LeadRow (consumer name, lead type, listing thumbnail, score pill, status select, time since created, first response timer that turns amber at 20 minutes and red at 30). LeadDetail drawer (contact info, message, consumer activity list, message thread, status history).

### Admin components
StatCard, FeedRunTable, ModerationQueueRow with approve and reject actions and inline reason.

## 4. Page templates

### Home
1. Header: logo, Buy, Rent, Sell, Home value, Find an agent, Sign in, primary button "List your home" or "Pro" depending on role.
2. Hero: one line headline from tagline, SearchBar large, three tabs above it: Buy, Rent, Home value.
3. Three entry cards: Buy a home, Rent a home, Sell your home. Each with a short line and a link.
4. Featured cities: grid of city cards with active count and median price from region stats.
5. Recently viewed (if any).
6. Footer: about, methodology, terms, privacy, fair housing statement, pro links, region switcher.

### City browse page (SEO)
H1 "Homes for sale in Toronto", one paragraph of stats from region stats (count, median price, median days on market), FilterBar, grid of 40 cards, pagination, map preview, neighborhood links, links to nearby cities, links to price band and home type pages ("Condos for sale in Toronto", "Homes under $800k in Toronto"). All links crawlable, all rendered server side.

### Property value page (off market)
Address as H1, EstimateCard large, value history chart, comps table with map, facts, "Is this your home? Claim it" button, "Thinking of selling?" card that opens a seller lead form, similar homes for sale nearby.

### Account
Left nav on desktop, tabs on mobile: Saved homes, Saved searches, Tours and inquiries, My homes, Settings.

### Pro leads
Table with filters by status and type, LeadRow per lead, LeadDetail drawer. Top strip: new today, response time median, leads this month, cap remaining.

## 5. Accessibility

1. All interactive elements reachable by keyboard, visible focus ring in accent.
2. Map has a list alternative on every page.
3. Gallery has alt text from caption or "Photo N of M, address".
4. Forms have labels, error messages tied to inputs with aria describedby.
5. Color never the only carrier of meaning: badges have text.

## 6. Empty, loading, error states (required for every list and form)

| State | Treatment |
|---|---|
| Loading list | 8 skeleton cards |
| No results | Illustration free. Heading "No homes match", line "Try widening the area or removing a filter", button "Clear filters", button "Save this search to get alerts" |
| Estimate unavailable | "Not enough recent sales nearby to estimate this home." with a "Get an agent's opinion" link that creates a sell lead |
| Form error | Inline field errors plus a summary at top |
| Offline map tiles | Neutral background with a retry link |
