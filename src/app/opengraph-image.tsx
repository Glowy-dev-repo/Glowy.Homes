import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

export const alt = `${brand.name}: ${brand.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default Open Graph image for every page that does not define its own: the logo mark on navy.
export default function OpengraphImage() {
  // The house from the brand logo, in white. The logo file is wider than the house, so it is cropped to the mark.
  const logo = readFileSync(join(process.cwd(), "public/brand/logo-white.svg"), "utf8");
  const house = logo.match(/<path[^>]*d="([^"]+)"/)?.[1] ?? "";
  const mark = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 27 100 42"><path fill="#FFFFFF" d="${house}"/></svg>`).toString("base64")}`;
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
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only */}
          <img src={mark} width={114} height={48} alt="" />
          <div style={{ fontSize: 48, fontWeight: 700, fontFamily: "sans-serif" }}>{brand.name}</div>
        </div>
        <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: -2 }}>{brand.tagline}</div>
        <div style={{ fontSize: 30, color: "#BFDBFE", fontFamily: "sans-serif" }}>
          {`Homes for sale and rent in ${brand.market.region}, with an estimate for every address.`}
        </div>
      </div>
    ),
    size,
  );
}
