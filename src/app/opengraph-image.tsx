import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

export const alt = `${brand.name}: ${brand.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default Open Graph image for every page that does not define its own: the mark on ink with the glow.
export default function OpengraphImage() {
  const mark = `data:image/svg+xml;base64,${readFileSync(join(process.cwd(), "public/brand/glowy-homes-mark.svg")).toString("base64")}`;
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
          backgroundColor: "#0C0A09",
          backgroundImage: "radial-gradient(60% 70% at 80% 20%, rgba(245,158,11,0.28), transparent 70%)",
          color: "#FAFAF9",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only */}
          <img src={mark} width={80} height={80} alt="" />
          <div style={{ fontSize: 44, fontWeight: 600 }}>{brand.name}</div>
        </div>
        <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: -2 }}>{brand.tagline}</div>
        <div style={{ fontSize: 30, color: "#D6D3D1", fontFamily: "sans-serif" }}>
          {`Homes for sale and rent in ${brand.market.region}, with an estimate for every address.`}
        </div>
      </div>
    ),
    size,
  );
}
