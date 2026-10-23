import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";
import { formatArea, formatBaths, formatBeds, formatPrice } from "@/lib/format";
import { getListingDetail } from "@/lib/listings/detail";
import { fullAddress } from "@/lib/listings/ldp";

export const alt = "Listing summary";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Per listing Open Graph image: price, facts and address on the brand background.
export default async function ListingOgImage({ params }: { params: Promise<{ id: string }> }) {
  const l = await getListingDetail((await params).id);
  const price = l ? formatPrice(l.status === "sold" && l.soldPrice ? l.soldPrice : l.price, { listingType: l.listingType }) : brand.name;
  const facts = l ? [formatBeds(l.beds), formatBaths(l.baths), formatArea(l.sqft)].filter(Boolean).join("  ·  ") : "";
  const address = l ? fullAddress(l) : brand.tagline;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#fafafa", color: "#18181b", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, background: brand.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700 }}>
            {brand.short}
          </div>
          <div style={{ fontSize: 34, fontWeight: 600 }}>{brand.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>{price}</div>
          <div style={{ fontSize: 40, color: "#3f3f46" }}>{facts}</div>
          <div style={{ fontSize: 40 }}>{address}</div>
        </div>
      </div>
    ),
    size,
  );
}
