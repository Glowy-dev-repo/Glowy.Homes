import { readFileSync } from "node:fs";
import sharp from "sharp";

// `npx tsx scripts/brand_icons.ts`: raster icons from the logo mark (public/brand/glowy-homes-mark.svg).
const svg = readFileSync("public/brand/glowy-homes-mark.svg");
await sharp(svg, { density: 600 }).resize(180, 180).png().toFile("src/app/apple-icon.png");
await sharp(svg, { density: 600 }).resize(512, 512).png().toFile("public/brand/glowy-homes-mark-512.png");
console.log("brand icons written");
