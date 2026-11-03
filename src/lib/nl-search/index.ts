import { SearchParams, type SearchParamsInput } from "@/types/search";
import { parseQueryAnthropic } from "./anthropic";
import { parseQueryRules, type ParseContext } from "./rules";

// Natural language search behind a provider interface (docs/05 Phase 6 task 2). With an
// ANTHROPIC_API_KEY the LLM parses the text; without one, or if the call fails or times out, the
// rule based parser does.

export type NlProvider = "anthropic" | "rules";
export type NlResult = { params: SearchParamsInput; provider: NlProvider };

const TIMEOUT_MS = 6_000;

export function nlProvider(): NlProvider {
  const key = process.env.ANTHROPIC_API_KEY;
  return key && !key.includes("replace") ? "anthropic" : "rules";
}

/** Keeps only fields that pass the SearchParams schema, dropping invalid ones one by one. */
export function sanitize(raw: SearchParamsInput): SearchParamsInput {
  const input: Record<string, unknown> = { ...raw };
  delete input.page;
  delete input.bounds;
  delete input.polygon;
  for (let i = 0; i < 20; i++) {
    const r = SearchParams.safeParse(input);
    if (r.success) break;
    for (const issue of r.error.issues) delete input[String(issue.path[0])];
  }
  for (const [k, v] of Object.entries(input)) if (v === undefined || v === null || v === "") delete input[k];
  return input as SearchParamsInput;
}

// Each model call is paid, and the route is public: identical searches reuse the last answer, and past a
// daily number of calls (per server, NL_DAILY_LLM_CAP, default 2000) the free rule based parser takes over.
const CACHE_MAX = 500;
const cache = new Map<string, SearchParamsInput>();
let budget = { day: "", used: 0 };

/** Takes one model call from today's budget; false once it is spent. */
export function takeLlmBudget(now: Date = new Date()): boolean {
  const day = now.toISOString().slice(0, 10);
  if (budget.day !== day) budget = { day, used: 0 };
  const cap = Number(process.env.NL_DAILY_LLM_CAP ?? 2000);
  if (budget.used >= cap) return false;
  budget.used++;
  return true;
}

/** `allowLlm` false (the caller is over their own limit) goes straight to the rules. */
export async function parseNaturalQuery(text: string, ctx: ParseContext, opts: { allowLlm?: boolean } = {}): Promise<NlResult> {
  const key = text.trim().toLowerCase().replace(/\s+/g, " ");
  const hit = cache.get(key);
  if (hit) return { params: hit, provider: "anthropic" };
  if (nlProvider() === "anthropic" && opts.allowLlm !== false && takeLlmBudget()) {
    try {
      const params = sanitize(await parseQueryAnthropic(text, ctx, process.env.ANTHROPIC_API_KEY!, AbortSignal.timeout(TIMEOUT_MS)));
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
      cache.set(key, params);
      return { params, provider: "anthropic" };
    } catch (e) {
      console.warn("[nl-search] falling back to rules:", e instanceof Error ? e.message : e);
    }
  }
  return { params: sanitize(parseQueryRules(text, ctx)), provider: "rules" };
}
