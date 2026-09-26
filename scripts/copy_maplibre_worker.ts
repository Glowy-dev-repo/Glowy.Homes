import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// MapLibre v6 loads its web worker relative to its own module URL, which bundlers rewrite.
// Serve the worker and its shared chunk from public/ instead; MapView points setWorkerUrl here.
const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "node_modules/maplibre-gl/dist");
const { version } = JSON.parse(readFileSync(resolve(root, "node_modules/maplibre-gl/package.json"), "utf8")) as { version: string };
const out = resolve(root, "public/maplibre", version);

mkdirSync(out, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  const target = resolve(out, file);
  if (!existsSync(target)) copyFileSync(resolve(dist, file), target);
}
console.log(`MapLibre worker ${version} ready in public/maplibre/${version}`);
