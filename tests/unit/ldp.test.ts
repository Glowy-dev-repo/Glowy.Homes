import { describe, expect, it } from "vitest";
import { describeFilters } from "@/components/account/SavedSearchList";
import { estimateCommute, haversineKm } from "@/lib/commute";
import type { ListingDetail } from "@/lib/listings/detail";
import { factGroups, fullAddress, keyFacts, listingJsonLd, listingPath, metaDescription } from "@/lib/listings/ldp";
import { minimumDownPayment, monthlyCost, monthlyCostRange, monthlyPrincipalAndInterest } from "@/lib/mortgage";
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
  address: { line1: "12 Maple Ave", line2: null, city: "Oakville", regionCode: "ON", postalCode: "L6J 1A1", country: "CA" },
  lat: 43.45,
  lng: -79.68,
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
};

describe("mortgage math (Canadian semi annual compounding)", () => {
  it("matches a known payment", () => {
    // $500,000 at 5% over 25 years, compounded semi annually: about $2,908.02 a month.
    expect(monthlyPrincipalAndInterest(500_000, 5, 25)).toBeCloseTo(2908.02, 1);
    expect(monthlyPrincipalAndInterest(300_000, 0, 25)).toBeCloseTo(1000, 5);
  });

  it("adds default insurance below 20% down and flags too little down", () => {
    const base = { price: 800_000, ratePercent: 5, amortizationYears: 25, propertyTaxAnnual: 6000, insuranceMonthly: 100, hoaMonthly: 0 };
    expect(monthlyCost({ ...base, downPaymentPercent: 20 }).insurancePremium).toBe(0);
    expect(monthlyCost({ ...base, downPaymentPercent: 10 }).insurancePremium).toBeCloseTo(720_000 * 0.031);
    expect(minimumDownPayment(800_000)).toBe(55_000);
    expect(monthlyCost({ ...base, downPaymentPercent: 5 }).belowMinimumDown).toBe(true);
  });

  it("shows a range around the chosen rate", () => {
    const r = monthlyCostRange({ price: 800_000, downPaymentPercent: 20, ratePercent: 5, amortizationYears: 25, propertyTaxAnnual: 6000, insuranceMonthly: 100, hoaMonthly: 0 });
    expect(r.low).toBeLessThan(r.mid);
    expect(r.high).toBeGreaterThan(r.mid);
  });
});

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
    expect(fullAddress(listing)).toBe("12 Maple Ave, Oakville, ON L6J 1A1");
    expect(listingPath(listing)).toBe(`/listing/${listing.id}/12-maple-ave-oakville`);
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
    expect(ld.offers.priceCurrency).toBe("CAD");
    expect(ld.about.address.postalCode).toBe("L6J 1A1");
    expect(ld.about.numberOfBedrooms).toBe(4);
  });

  it("writes a meta description without dashes", () => {
    const d = metaDescription(listing);
    expect(d).toMatch(/^4 bed, 3 bath, 200 m², detached for sale at \$1,249,000 in Oakville\./);
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d).not.toMatch(/[–—]| - /);
  });
});

describe("saved search schemas", () => {
  it("validates create and update payloads", () => {
    expect(CreateSavedSearch.safeParse({ name: "", filters: {} }).success).toBe(false);
    expect(CreateSavedSearch.parse({ name: "Homes", filters: { city: "toronto" } }).alertFrequency).toBe("daily");
    expect(UpdateSavedSearch.safeParse({}).success).toBe(false);
    expect(UpdateSavedSearch.safeParse({ alertFrequency: "weekly" }).success).toBe(true);
  });

  it("describes filters in plain words", () => {
    const text = describeFilters(SearchParams.parse({ city: "toronto", priceMax: 900000, bedsMin: 3, propertyTypes: ["condo"] }));
    expect(text).toBe("For sale, Toronto, up to $900K, 3+ beds, Condo");
  });
});
