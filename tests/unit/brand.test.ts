import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBrandBlock, renderBrandCss, renderBrandTs, shade, slugify } from "../../scripts/lib/brand_config";
import { brand } from "@/config/brand";

const claudeMd = readFileSync("CLAUDE.md", "utf8");

describe("brand config", () => {
  it("parses the BRAND CONFIG block, including quoted values that contain #", () => {
    const cfg = parseBrandBlock(claudeMd);
    expect(cfg.brand_name).toBe("Glowy Homes");
    expect(cfg.brand_color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(cfg.primary_market_cities.length).toBeGreaterThan(0);
  });

  it("generated brand.ts matches CLAUDE.md (run npm run brand:sync if this fails)", () => {
    const cfg = parseBrandBlock(claudeMd);
    expect(readFileSync("src/config/brand.ts", "utf8")).toBe(renderBrandTs(cfg));
    expect(brand.name).toBe(cfg.brand_name);
  });

  it("maps the neutral family to real color values, not var() references", () => {
    const cfg = parseBrandBlock(claudeMd);
    const css = renderBrandCss(cfg, readFileSync("node_modules/tailwindcss/theme.css", "utf8"));
    expect(css).toContain(`--color-accent: ${cfg.brand_color};`);
    expect(css).toMatch(/--color-neutral-500: oklch\(/);
    expect(css).not.toContain("var(");
  });

  it("rejects a malformed block", () => {
    expect(() => parseBrandBlock("## 2. BRAND CONFIG\n```yaml\nbrand_name: x\n```")).toThrow();
  });

  it("shades and slugifies", () => {
    expect(shade("#FFFFFF", 0.1)).toBe("#E6E6E6");
    expect(slugify("Saint Catharines North")).toBe("saint-catharines-north");
    expect(slugify("Montréal")).toBe("montreal");
  });
});
