import { describe, expect, it } from "vitest";
import { idxClient } from "@/lib/idx/client";
import { findAddress, findPrice, findZip, idxLeadToInput, type IdxLead } from "@/lib/idx/leads";

// Shaped like GET /leads/lead/{id} from IDX Broker (apiversion 1.8.0).
const lead: IdxLead = {
  id: "42",
  firstName: "Dana",
  lastName: "Reyes",
  email: " Dana@Example.com ",
  phone: "(805) 555-0100",
  zipCode: "91320",
  disabled: "n",
  blacklisted: "n",
  subscribeDate: "2026-10-16 03:01:26",
  recentlyViewedListings: [],
};

describe("finding a home's ZIP code, price and address in IDX Broker records", () => {
  it("reads ZIP fields by name, at any depth, and ignores bad values", () => {
    expect(findZip({ property: { zipcode: "93021" } })).toBe("93021");
    expect(findZip({ postalCode: "93021-1234" })).toBe("93021");
    expect(findZip({ zip: 93065 })).toBe("93065");
    expect(findZip({ zipcode: "N/A", city: "Moorpark" })).toBeNull();
  });

  it("reads a ZIP code from an address or a listing page link", () => {
    expect(findZip({ propertyName: "123 Main St, Moorpark, CA 93021" })).toBe("93021");
    expect(findZip({ url: "https://glowyhomes.idxbroker.com/idx/details/listing/a681/225012345/123-Main-St-Moorpark-CA-93021" })).toBe("93021");
    expect(findZip({ note: "called about 12345 offers" })).toBeNull();
  });

  it("reads price and address", () => {
    expect(findPrice({ property: { listingPrice: "$1,250,000" } })).toBe(1250000);
    expect(findPrice({ price: 0 })).toBeNull();
    expect(findAddress({ propertyName: " 123 Main St, Moorpark, CA 93021 " })).toBe("123 Main St, Moorpark, CA 93021");
  });
});

describe("IDX Broker lead to our lead", () => {
  it("prefers the ZIP code of a saved home over the lead's own address", () => {
    const saved = [{ id: "1", propertyName: "5076 Island Forest Pl, Westlake Village, CA 91362", property: { idxID: "a681", listingID: "225000001", listingPrice: "3200000" } }];
    const input = idxLeadToInput(lead, saved)!;
    expect(input).toMatchObject({
      externalRef: "idx:42",
      name: "Dana Reyes",
      email: "dana@example.com",
      phone: "8055550100",
      zip: "91362",
      zipSource: "saved_home",
      address: "5076 Island Forest Pl, Westlake Village, CA 91362",
      price: 3200000,
    });
    expect(input.message).toContain("Saved 1 home.");
  });

  it("falls back to a recently viewed home, then to the ZIP code they entered", () => {
    const viewed = idxLeadToInput({ ...lead, recentlyViewedListings: [{ address: "1 Elm St, Moorpark, CA 93021" }] }, null)!;
    expect(viewed).toMatchObject({ zip: "93021", zipSource: "viewed_home" });
    const own = idxLeadToInput(lead, [])!;
    expect(own).toMatchObject({ zip: "91320", zipSource: "lead_address", address: null, price: null });
    const none = idxLeadToInput({ ...lead, zipCode: "" }, [])!;
    expect(none).toMatchObject({ zip: null, zipSource: null });
  });

  it("skips leads that cannot be contacted", () => {
    expect(idxLeadToInput({ ...lead, email: "" }, [])).toBeNull();
    expect(idxLeadToInput({ ...lead, email: "not an email" }, [])).toBeNull();
    expect(idxLeadToInput({ ...lead, disabled: "y" }, [])).toBeNull();
    expect(idxLeadToInput({ ...lead, blacklisted: "y" }, [])).toBeNull();
  });

  it("keeps only usable phone numbers and names an unnamed lead by email", () => {
    const input = idxLeadToInput({ ...lead, firstName: "", lastName: null, phone: "123" }, [])!;
    expect(input.name).toBe("dana");
    expect(input.phone).toBeNull();
  });
});

describe("IDX Broker client", () => {
  it("sends the key, treats 204 as empty and only follows links on the API host", async () => {
    const calls: { url: string; key: string | null }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, key: new Headers(init?.headers).get("accesskey") });
      return url.endsWith("/empty") ? new Response(null, { status: 204 }) : new Response('{"ok":1}', { status: 200 });
    }) as typeof fetch;
    const client = idxClient("k1", fake);
    expect(await client.get("/leads/lead")).toEqual({ ok: 1 });
    expect(await client.get("/empty")).toBeNull();
    expect(await client.get("https://api.idxbroker.com/leads/lead?offset=50")).toEqual({ ok: 1 });
    await expect(client.get("https://evil.example/leads")).rejects.toThrow(/Refusing/);
    expect(calls.map((c) => c.key)).toEqual(["k1", "k1", "k1"]);
  });
});
