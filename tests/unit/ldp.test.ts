import { describe, expect, it } from "vitest";
import { describeFilters } from "@/components/account/SavedSearchList";
import { estimateCommute, haversineKm } from "@/lib/commute";
import type { ListingDetail } from "@/lib/listings/detail";
import { factGroups, fullAddress, keyFacts, listingJsonLd, listingPath, metaDescription } from "@/lib/listings/ldp";
import { CreateSavedSearch, UpdateSavedSearch } from "@/lib/saved-search-schema";
import { SearchParams } from "@/types/search";

const listing: ListingDetail = {
  id: "00000000-0000-4000-8000-000000000001",
  propertyId: "00000000-0000-4000-8000-000000000002",
  listingType: "sale",
  status: "active",
  source: "synthetic",
  sourceListingId: "GH0000001",
  price: 1_249_000,
  originalPrice: 1_299_000,
  soldPrice: null,
  listDate: "2026-09-01",
  statusDate: "2026-09-10",
  soldDate: null,
  availableDate: null,
  description: "Bright 4 bedroom detached home.",
  features: { interior: ["Gas fireplace"], exterior: ["Deck"], building: [], community: ["Near parks"] },
  rentalTerms: null,
  hoaFee: null,
  taxAnnual: 8200,
  virtualTourUrl: null,
  brokerageName: "Northlight Realty",
  isFeatured: false,
  saveCount: 3,
  updatedAt: "2026-09-10",
  address: { line1: "12 Maple Ave", line2: null, city: "Pasadena", regionCode: "CA", postalCode: "91101", country: "US" },
  lat: 34.15,
  lng: -118.14,
  propertyType: "detached",
  beds: 4,
  baths: 3,
  sqft: 2150,
  lotSqft: 5000,
  yearBuilt: 1998,
  stories: 2,
  parkingSpaces: 2,
  facts: { heating: "Forced air, gas", cooling: "Central air", basement: "Finished" },
  city: null,
  neighborhood: null,
  media: [],
  priceHistory: [],
  agent: null,
  contactPrefs: null,
  listAgentName: "Sam Lee",
  listAgentPhone: "(213) 555 0101",
  listAgentEmail: null,
  listOfficePhone: "(213) 555 0200",
  coListAgentName: null,
  coListOfficeName: null,
  hideEstimate: false,
  addressDisplay: true,
  sourceUpdatedAt: null,
};

describe("commute estimate", () => {
  it("gives ranges from straight line distance", () => {
    expect(haversineKm([-79.38, 43.65], [-79.38, 43.74])).toBeCloseTo(10, 0);
    const c = estimateCommute([-79.38, 43.65], [-79.38, 43.74]);
    expect(c.car[0]).toBeLessThan(c.car[1]);
    expect(c.transit[0]).toBeGreaterThan(c.car[0]);
  });
});

describe("LDP helpers", () => {
  it("formats address, path and key facts", () => {
    expect(fullAddress(listing)).toBe("12 Maple Ave, Pasadena, CA 91101");
    expect(listingPath(listing)).toBe(`/listing/${listing.id}/12-maple-ave-pasadena`);
    const labels = keyFacts(listing).map((f) => f.label);
    expect(labels).toEqual(["Home type", "Year built", "Lot", "Parking", "Heating", "Cooling", "MLS ID"]);
  });

  it("groups facts and adds rental terms for rentals", () => {
    expect(factGroups(listing).map((g) => g.title)).toEqual(["Interior", "Exterior", "Building", "Utilities", "Community"]);
    const rent = { ...listing, listingType: "rent" as const, rentalTerms: { pets: true, furnished: false, deposit: 3000 } };
    expect(factGroups(rent)[0].title).toBe("Rental terms");
  });

  it("emits RealEstateListing JSON LD with price and address", () => {
    const ld = listingJsonLd(listing, "https://glowy.homes", ["https://glowy.homes/a.webp"]);
    expect(ld["@type"]).toBe("RealEstateListing");
    expect(ld.offers.price).toBe(1_249_000);
    expect(ld.offers.priceCurrency).toBe("USD");
    expect(ld.about.address.postalCode).toBe("91101");
    expect(ld.about.numberOfBedrooms).toBe(4);
  });

  it("writes a meta description without dashes", () => {
    const d = metaDescription(listing);
    expect(d).toMatch(/^4 bed, 3 bath, 2,150 sq ft, detached for sale at \$1,249,000 in Pasadena\./);
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d).not.toMatch(/[–—]| - /);
  });
});

describe("saved search schemas", () => {
  it("validates create and update payloads", () => {
    expect(CreateSavedSearch.safeParse({ name: "", filters: {} }).success).toBe(false);
    expect(CreateSavedSearch.parse({ name: "Homes", filters: { city: "los-angeles" } }).alertFrequency).toBe("daily");
    expect(UpdateSavedSearch.safeParse({}).success).toBe(false);
    expect(UpdateSavedSearch.safeParse({ alertFrequency: "weekly" }).success).toBe(true);
  });

  it("describes filters in plain words", () => {
    const text = describeFilters(SearchParams.parse({ city: "los-angeles", priceMax: 900000, bedsMin: 3, propertyTypes: ["condo"] }));
    expect(text).toBe("For sale, Los Angeles, up to $900K, 3+ beds, Condo");
  });
});
