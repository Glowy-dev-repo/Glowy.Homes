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

export async function parseNaturalQuery(text: string, ctx: ParseContext): Promise<NlResult> {
  if (nlProvider() === "anthropic") {
    try {
      const params = await parseQueryAnthropic(text, ctx, process.env.ANTHROPIC_API_KEY!, AbortSignal.timeout(TIMEOUT_MS));
      return { params: sanitize(params), provider: "anthropic" };
    } catch (e) {
      console.warn("[nl-search] falling back to rules:", e instanceof Error ? e.message : e);
    }
  }
  return { params: sanitize(parseQueryRules(text, ctx)), provider: "rules" };
}
