import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseBrandBlock, renderBrandCss, renderBrandTs } from "./lib/brand_config";

const root = resolve(import.meta.dirname, "..");
const cfg = parseBrandBlock(readFileSync(resolve(root, "CLAUDE.md"), "utf8"));
const tailwindTheme = readFileSync(resolve(root, "node_modules/tailwindcss/theme.css"), "utf8");

writeFileSync(resolve(root, "src/config/brand.ts"), renderBrandTs(cfg));
writeFileSync(resolve(root, "src/styles/brand.css"), renderBrandCss(cfg, tailwindTheme));

console.log(`Brand synced: ${cfg.brand_name} (${cfg.domain})`);
