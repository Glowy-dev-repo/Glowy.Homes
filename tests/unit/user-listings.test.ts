import { describe, expect, it } from "vitest";
import { contactInfoIn, fairHousingIssue, MIN_PHOTOS, runListingChecks } from "@/lib/listings/moderation-checks";
import { RentalApplicationProfile, UserListingInput } from "@/lib/listings/user-listing-schema";

const photo = (i: number) => ({ storageKey: `uploads/0b8f3c2e-1111-4a4a-9a9a-00000000000${i}/7c1d2e3f-2222-4b4b-8b8b-00000000000${i}` });

const rental = {
  listingType: "rent" as const,
  propertyId: "8a1f6c52-3e7b-4d2a-9f10-5b6c7d8e9f01",
  propertyType: "condo" as const,
  beds: 2,
  baths: 1,
  sqft: 780,
  price: 2600,
  description: "Bright two bedroom condo with a south facing balcony, close to transit and parks.",
  availableDate: "2026-11-01",
  rentalTerms: { pets: true, furnished: false, laundry: "In suite" as const, parking: true, leaseMinMonths: 12, deposit: 2600 },
  photos: [photo(1), photo(2), photo(3)],
  contact: { preferred: "email" as const },
};

describe("user listing schema (docs/05 Phase 5)", () => {
  it("accepts a complete rental", () => {
    expect(UserListingInput.safeParse(rental).success).toBe(true);
  });

  it(`rejects fewer than ${MIN_PHOTOS} photos on the server`, () => {
    const r = UserListingInput.safeParse({ ...rental, photos: [photo(1), photo(2)] });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === "photos")).toBe(true);
  });

  it("requires rental terms and an available date for rentals", () => {
    expect(UserListingInput.safeParse({ ...rental, rentalTerms: undefined }).success).toBe(false);
    expect(UserListingInput.safeParse({ ...rental, availableDate: undefined }).success).toBe(false);
    // Homes for sale come from the MLS only; owners cannot post them.
    expect(UserListingInput.safeParse({ ...rental, listingType: "sale", rentalTerms: undefined, availableDate: undefined, price: 640000 }).success).toBe(false);
  });

  it("requires a phone number when phone is the preferred contact", () => {
    expect(UserListingInput.safeParse({ ...rental, contact: { preferred: "phone" } }).success).toBe(false);
    expect(UserListingInput.safeParse({ ...rental, contact: { preferred: "phone", phone: "(416) 555 0142" } }).success).toBe(true);
  });

  it("only accepts storage keys from our own upload path", () => {
    expect(UserListingInput.safeParse({ ...rental, photos: [photo(1), photo(2), { storageKey: "../../etc/passwd" }] }).success).toBe(false);
  });
});

describe("moderation auto checks (docs/03 section 7)", () => {
  const base = { photoCount: 5, price: 2600, estimate: 2500, description: rental.description, hasLocation: true };

  it("passes a clean listing", () => {
    expect(runListingChecks(base)).toEqual({ passed: true, failed: [] });
  });

  it("flags too few photos, a wild price and a missing location", () => {
    const r = runListingChecks({ ...base, photoCount: 2, price: 100, hasLocation: false });
    expect(r.passed).toBe(false);
    expect(r.failed).toEqual([`fewer than ${MIN_PHOTOS} photos`, "price far from the estimate", "address did not geocode"]);
  });

  it("skips the price check when there is no estimate", () => {
    expect(runListingChecks({ ...base, price: 1, estimate: null }).passed).toBe(true);
  });

  it("detects contact details and links in descriptions", () => {
    expect(contactInfoIn("Call me at 416-555-0142")).toBe(true);
    expect(contactInfoIn("Email jane@example.com for a viewing")).toBe(true);
    expect(contactInfoIn("See more at www.example.com")).toBe(true);
    expect(contactInfoIn("Two bedrooms, 780 sq ft, built 2012")).toBe(false);
  });

  it("detects fair housing violations", () => {
    expect(fairHousingIssue("Quiet building, adults only")).toBe(true);
    expect(fairHousingIssue("No kids please")).toBe(true);
    expect(fairHousingIssue("Perfect for a young professional")).toBe(true);
    expect(fairHousingIssue("Close to schools, great for families")).toBe(false);
  });
});

describe("rental application profile (docs/01 R4)", () => {
  const profile = { fullName: "Sam Rivera", email: "Sam@Example.com ", phone: "416 555 0199", moveInDate: "2026-11-01", occupants: 2, annualIncome: 85000 };

  it("normalizes email and fills optional defaults", () => {
    const r = RentalApplicationProfile.parse(profile);
    expect(r.email).toBe("sam@example.com");
    expect(r.references).toEqual([]);
    expect(r.pets).toBe("");
  });

  it("rejects a bad phone and zero occupants", () => {
    expect(RentalApplicationProfile.safeParse({ ...profile, phone: "123" }).success).toBe(false);
    expect(RentalApplicationProfile.safeParse({ ...profile, occupants: 0 }).success).toBe(false);
  });
});
