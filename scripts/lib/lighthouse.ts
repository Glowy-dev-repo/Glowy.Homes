import { chromium } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

export type LighthouseScores = { performance: number; accessibility: number; seo: number; bestPractices: number };

/**
 * Mobile Lighthouse run (the default Lighthouse form factor, as CLAUDE.md section 9 targets)
 * using Playwright's Chromium, so no system Chrome is needed. Scores are 0 to 100.
 */
export async function runLighthouse(url: string, categories = ["performance", "accessibility", "seo", "best-practices"]) {
  const chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  try {
    const result = await lighthouse(url, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: categories });
    if (!result) throw new Error("Lighthouse returned no result");
    const c = result.lhr.categories;
    const score = (k: string) => Math.round((c[k]?.score ?? 0) * 100);
    const failing = Object.values(result.lhr.audits)
      .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode === "binary")
      .map((a) => a.id);
    return {
      scores: { performance: score("performance"), accessibility: score("accessibility"), seo: score("seo"), bestPractices: score("best-practices") } as LighthouseScores,
      failing,
    };
  } finally {
    await chrome.kill();
  }
}

// CLI: tsx scripts/lib/lighthouse.ts <url>
if (process.argv[1]?.endsWith("lighthouse.ts") && process.argv[2]) {
  const { scores, failing } = await runLighthouse(process.argv[2]);
  console.log(JSON.stringify(scores), failing.length ? `failing: ${failing.join(", ")}` : "");
}
