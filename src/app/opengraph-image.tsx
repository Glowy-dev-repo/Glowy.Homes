import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

export const alt = `${brand.name}: ${brand.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default Open Graph image for every page that does not define its own.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#fafafa",
          color: "#18181b",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: brand.color,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            {brand.short}
          </div>
          <div style={{ fontSize: 40, fontWeight: 600 }}>{brand.name}</div>
        </div>
        <div style={{ fontSize: 80, fontWeight: 600, letterSpacing: -2 }}>{brand.tagline}</div>
        <div style={{ fontSize: 30, color: "#52525b" }}>
          {`Homes for sale and rent in ${brand.market.region}, with an estimate for every address.`}
        </div>
      </div>
    ),
    size,
  );
}
