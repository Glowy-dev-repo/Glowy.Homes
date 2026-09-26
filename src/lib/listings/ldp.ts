import { brand } from "@/config/brand";
import type { FactGroup } from "@/components/listing/FactsGrid";
import { daysBetween, formatArea, formatDate, formatPrice, propertyTypeLabel } from "@/lib/format";
import { addressSlug } from "@/lib/slug";
import type { ListingSummary } from "@/types/search";
import type { ListingDetail } from "./detail";

// Pure helpers that shape a ListingDetail for the LDP. Kept separate so they are unit tested.

export function fullAddress(l: ListingDetail): string {
  const street = [l.address.line2, l.address.line1].filter(Boolean).join(", ");
  return `${street}, ${l.address.city}, ${l.address.regionCode} ${l.address.postalCode}`;
}

export function listingPath(l: Pick<ListingDetail, "id" | "address">): string {
  return `/listing/${l.id}/${addressSlug(l.address.line1, l.address.line2, l.address.city)}`;
}

export function toSummary(l: ListingDetail): ListingSummary {
  return {
    id: l.id,
    listingType: l.listingType,
    status: l.status,
    price: l.price,
    soldPrice: l.soldPrice,
    beds: l.beds,
    baths: l.baths,
    sqft: l.sqft,
    propertyType: l.propertyType,
    listDate: l.listDate,
    statusDate: l.statusDate,
    isFeatured: l.isFeatured,
    brokerageName: l.brokerageName,
    addressLine1: l.address.line1,
    addressLine2: l.address.line2,
    city: l.address.city,
    lat: l.lat,
    lng: l.lng,
    coverKey: l.media[0]?.storageKey ?? null,
    coverBlur: l.media[0]?.blurDataUrl ?? null,
  };
}

export function daysOnMarket(l: ListingDetail, now = new Date()): number {
  const end = l.soldDate ? new Date(`${l.soldDate}T00:00:00Z`) : now;
  return daysBetween(l.listDate, end);
}

const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/** docs/01 LDP section 5: type, year built, lot, parking, heating, cooling, condo fee, MLS ID. */
export function keyFacts(l: ListingDetail) {
  const facts: { label: string; value: string }[] = [{ label: "Home type", value: propertyTypeLabel(l.propertyType) }];
  if (l.yearBuilt) facts.push({ label: "Year built", value: String(l.yearBuilt) });
  if (l.lotSqft) facts.push({ label: "Lot", value: formatArea(l.lotSqft)! });
  if (l.parkingSpaces !== null) facts.push({ label: "Parking", value: l.parkingSpaces === 0 ? "None" : `${l.parkingSpaces} ${l.parkingSpaces === 1 ? "space" : "spaces"}` });
  if (str(l.facts.heating)) facts.push({ label: "Heating", value: str(l.facts.heating)! });
  if (str(l.facts.cooling)) facts.push({ label: "Cooling", value: str(l.facts.cooling)! });
  if (l.hoaFee) facts.push({ label: l.propertyType === "condo" ? "Condo fee" : "HOA fee", value: `${formatPrice(l.hoaFee)}/mo` });
  if (l.sourceListingId) facts.push({ label: "MLS ID", value: l.sourceListingId });
  return facts;
}

/** docs/01 LDP section 7: interior, exterior, building, utilities, community. */
export function factGroups(l: ListingDetail): FactGroup[] {
  const interior = [
    ...(l.beds !== null ? [{ label: "Bedrooms", value: l.beds === 0 ? "Studio" : String(l.beds) }] : []),
    ...(l.baths !== null ? [{ label: "Bathrooms", value: String(l.baths) }] : []),
    ...(l.sqft ? [{ label: "Interior area", value: formatArea(l.sqft)! }] : []),
    ...(str(l.facts.basement) ? [{ label: "Basement", value: str(l.facts.basement)! }] : []),
    ...(l.features.interior ?? []).map((f) => ({ label: f, value: "Yes" })),
  ];
  const exterior = [
    ...(str(l.facts.exterior) ? [{ label: "Exterior", value: str(l.facts.exterior)! }] : []),
    ...(str(l.facts.roof) ? [{ label: "Roof", value: str(l.facts.roof)! }] : []),
    ...(l.stories ? [{ label: "Stories", value: String(l.stories) }] : []),
    ...(str(l.facts.parking) ? [{ label: "Parking type", value: str(l.facts.parking)! }] : []),
    ...(l.features.exterior ?? []).map((f) => ({ label: f, value: "Yes" })),
  ];
  const building = (l.features.building ?? []).map((f) => ({ label: f, value: "Yes" }));
  const utilities = [
    ...(str(l.facts.heating) ? [{ label: "Heating", value: str(l.facts.heating)! }] : []),
    ...(str(l.facts.cooling) ? [{ label: "Cooling", value: str(l.facts.cooling)! }] : []),
    ...(l.rentalTerms?.utilities_included?.length ? [{ label: "Utilities included", value: l.rentalTerms.utilities_included.join(", ") }] : []),
  ];
  const community = (l.features.community ?? []).map((f) => ({ label: f, value: "Yes" }));
  const groups: FactGroup[] = [
    { title: "Interior", facts: interior },
    { title: "Exterior", facts: exterior },
    { title: "Building", facts: building },
    { title: "Utilities", facts: utilities },
    { title: "Community", facts: community },
  ];
  if (l.listingType === "rent" && l.rentalTerms) {
    const t = l.rentalTerms;
    groups.unshift({
      title: "Rental terms",
      facts: [
        ...(l.availableDate ? [{ label: "Available", value: formatDate(l.availableDate) }] : []),
        ...(t.lease_min_months ? [{ label: "Minimum lease", value: `${t.lease_min_months} months` }] : []),
        ...(t.deposit ? [{ label: "Deposit", value: formatPrice(t.deposit) }] : []),
        { label: "Pets", value: t.pets ? "Allowed" : "Not allowed" },
        { label: "Furnished", value: t.furnished ? "Yes" : "No" },
        ...(t.laundry ? [{ label: "Laundry", value: t.laundry }] : []),
        ...(t.parking !== undefined ? [{ label: "Parking", value: t.parking ? "Included" : "Not included" }] : []),
      ],
    });
  }
  return groups;
}

/** schema.org RealEstateListing JSON LD (CLAUDE.md section 11.6). */
export function listingJsonLd(l: ListingDetail, appUrl: string, imageUrls: string[]) {
  const residenceType = l.propertyType === "condo" ? "Apartment" : l.propertyType === "detached" ? "SingleFamilyResidence" : "House";
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: fullAddress(l),
    url: `${appUrl}${listingPath(l)}`,
    datePosted: l.listDate,
    description: l.description ?? undefined,
    image: imageUrls,
    offers: {
      "@type": "Offer",
      price: l.status === "sold" && l.soldPrice ? l.soldPrice : l.price,
      priceCurrency: brand.currency,
      availability: l.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      ...(l.listingType === "rent" ? { priceSpecification: { "@type": "UnitPriceSpecification", price: l.price, priceCurrency: brand.currency, unitText: "MONTH" } } : {}),
    },
    about: {
      "@type": residenceType,
      address: {
        "@type": "PostalAddress",
        streetAddress: [l.address.line1, l.address.line2].filter(Boolean).join(", "),
        addressLocality: l.address.city,
        addressRegion: l.address.regionCode,
        postalCode: l.address.postalCode,
        addressCountry: l.address.country,
      },
      geo: { "@type": "GeoCoordinates", latitude: l.lat, longitude: l.lng },
      ...(l.beds !== null ? { numberOfBedrooms: l.beds } : {}),
      ...(l.baths !== null ? { numberOfBathroomsTotal: l.baths } : {}),
      ...(l.sqft ? { floorSize: { "@type": "QuantitativeValue", value: l.sqft, unitCode: "FTK" } } : {}),
      ...(l.yearBuilt ? { yearBuilt: l.yearBuilt } : {}),
    },
  };
}

export function metaDescription(l: ListingDetail): string {
  const facts = [
    l.beds !== null ? `${l.beds} bed` : null,
    l.baths !== null ? `${l.baths} bath` : null,
    l.sqft ? formatArea(l.sqft) : null,
    propertyTypeLabel(l.propertyType).toLowerCase(),
  ].filter(Boolean);
  const price = formatPrice(l.price, { listingType: l.listingType });
  const lead = `${facts.join(", ")} ${l.listingType === "rent" ? "for rent" : "for sale"} at ${price} in ${l.address.city}.`;
  const rest = (l.description ?? "").slice(0, 150 - lead.length);
  return `${lead} ${rest}`.trim();
}
