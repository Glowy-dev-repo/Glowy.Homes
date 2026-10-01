import { describe, expect, it } from "vitest";
import { formatArea, formatPrice, listedAgo, toSqft } from "@/lib/format";
import { syntheticBlurDataUrl, syntheticPalette, syntheticStorageKey } from "@/lib/media/synthetic";
import { mediaUrl, snapWidth, SYNTHETIC_STYLE_VERSION } from "@/lib/media/urls";
import { browseSummary, quickLinks } from "@/lib/search/browse-copy";
import { clusterCellSize, polygonWkt } from "@/lib/search/postgres";
import { createRateLimiter } from "@/server/api/rate-limit";

describe("clusters and polygons", () => {
  it("sizes grid cells from the extent", () => {
    expect(clusterCellSize([-80, 43, -79, 43.5])).toBeCloseTo(0.1);
    expect(clusterCellSize(null)).toBe(0.05);
  });

  it("closes polygon rings", () => {
    expect(polygonWkt([[0, 0], [1, 0], [1, 1]])).toBe("SRID=4326;POLYGON((0 0, 1 0, 1 1, 0 0))");
  });
});

describe("rate limiter", () => {
  it("allows the per minute budget, then refills over time", () => {
    let now = 0;
    const take = createRateLimiter(3, () => now);
    expect([take("a"), take("a"), take("a"), take("a")]).toEqual([true, true, true, false]);
    expect(take("b")).toBe(true);
    now += 20_000;
    expect(take("a")).toBe(true);
  });
});

describe("formatting", () => {
  it("formats USD prices, rents and areas in square feet", () => {
    expect(formatPrice(1249000)).toBe("$1,249,000");
    expect(formatPrice(3025, { listingType: "rent" })).toBe("$3,025/mo");
    expect(formatArea(2150)).toBe("2,150 sq ft");
    expect(toSqft(100)).toBe(100);
    expect(listedAgo("2026-09-23", new Date("2026-09-26T15:00:00Z"))).toBe("Listed 3 days ago");
  });
});

describe("browse copy", () => {
  it("writes stats sentences without dashes", () => {
    const text = browseSummary("Los Angeles", "sale", { listing_count: 7806, median_price: 1348000, median_dom: 17 });
    expect(text).toBe(
      "There are 7,806 homes for sale in Los Angeles. The median list price is $1,348,000. Homes here have typically been listed for 17 days.",
    );
    for (const s of [text, browseSummary("San Jose", "rent", {}), ...quickLinks("Los Angeles", "sale").map((q) => q.label)]) {
      expect(s).not.toMatch(/[–—]| - /);
    }
  });
});

describe("media URLs", () => {
  it("snaps widths and routes synthetic and local keys to the app", () => {
    expect(snapWidth(300)).toBe(400);
    expect(snapWidth(3000)).toBe(1600);
    expect(mediaUrl("synthetic/GH0000001/0", 640)).toBe(`/media/synthetic/GH0000001/0/photo.svg?v=${SYNTHETIC_STYLE_VERSION}`);
    expect(mediaUrl("local/listings/a/b", 400)).toBe("/media/local/listings/a/b/400.webp");
  });

  it("derives stable synthetic colors and keys", () => {
    expect(syntheticPalette("synthetic://GH1/0")).toEqual(syntheticPalette("synthetic://GH1/0"));
    expect(syntheticBlurDataUrl("synthetic://GH1/0")).not.toBe(syntheticBlurDataUrl("synthetic://GH1/1"));
    expect(syntheticStorageKey("synthetic://GH1/12")).toBe("synthetic/GH1/12");
    expect(syntheticStorageKey("synthetic://../etc/1")).toBeNull();
  });
});
