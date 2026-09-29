import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

export const alt = `${brand.name}: ${brand.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default Open Graph image for every page that does not define its own: the logo on navy.
export default function OpengraphImage() {
  // The owner's logo in white (public/brand/logo-white.svg).
  const logo = `data:image/svg+xml;base64,${readFileSync(join(process.cwd(), "public/brand/logo-white.svg")).toString("base64")}`;
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
          backgroundColor: "#0B1B3F",
          backgroundImage: "radial-gradient(60% 70% at 80% 20%, rgba(59,130,246,0.40), transparent 70%)",
          color: "#FFFFFF",
          fontFamily: "serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only */}
        <img src={logo} width={360} height={110} alt="" style={{ marginLeft: -9 }} />
        <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: -2 }}>{brand.tagline}</div>
        <div style={{ fontSize: 30, color: "#BFDBFE", fontFamily: "sans-serif" }}>
          {`Homes for sale and rent in ${brand.market.region}, with an estimate for every address.`}
        </div>
      </div>
    ),
    size,
  );
}
