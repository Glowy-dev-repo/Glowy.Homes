import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

export type LighthouseScores = { performance: number; accessibility: number; seo: number; bestPractices: number };

/**
 * Mobile Lighthouse run (the default Lighthouse form factor, as CLAUDE.md section 9 targets)
 * using Playwright's Chromium, so no system Chrome is needed. Scores are 0 to 100.
 */
export async function runLighthouse(url: string, categories = ["performance", "accessibility", "seo", "best-practices"]) {
  // Own profile dir: chrome-launcher's temp dir cleanup fails on Windows while Chrome still holds files.
  const userDataDir = resolve(process.cwd(), ".gate", `lighthouse-${process.pid}-${Date.now()}`);
  mkdirSync(userDataDir, { recursive: true });
  const chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
    userDataDir,
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
    try {
      chrome.kill();
    } catch {
      // Process already gone.
    }
    setTimeout(() => rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5 }), 1000).unref();
  }
}

/**
 * Median of several runs per score. Lighthouse scores on one machine vary by several points
 * between runs; its own guidance is to report the median rather than a single run.
 */
export async function runLighthouseMedian(url: string, categories: string[], runs = 3) {
  const results: Awaited<ReturnType<typeof runLighthouse>>[] = [];
  for (let i = 0; i < runs; i++) results.push(await runLighthouse(url, categories));
  const median = (k: keyof LighthouseScores) => results.map((r) => r.scores[k]).sort((a, b) => a - b)[Math.floor(runs / 2)];
  const scores: LighthouseScores = { performance: median("performance"), accessibility: median("accessibility"), seo: median("seo"), bestPractices: median("bestPractices") };
  return { scores, failing: results[0].failing, all: results.map((r) => r.scores.performance) };
}

// CLI: tsx scripts/lib/lighthouse.ts <url>
if (process.argv[1]?.endsWith("lighthouse.ts") && process.argv[2]) {
  const { scores, failing } = await runLighthouse(process.argv[2]);
  console.log(JSON.stringify(scores), failing.length ? `failing: ${failing.join(", ")}` : "");
}
