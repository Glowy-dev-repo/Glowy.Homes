import { PROPERTY_TYPES } from "@/db/schema/listings";
import { SORTS, type SearchParamsInput } from "@/types/search";
import type { ParseContext } from "./rules";

// LLM provider for natural language search (docs/05 Phase 6 task 2): the Anthropic Messages API
// with a forced tool call, so the model can only answer with filter fields. The result is still
// validated with the SearchParams schema by the caller.

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const TOOL = {
  name: "set_search_filters",
  description: "Set the home search filters that match the user's request. Leave out anything the user did not ask for.",
  input_schema: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["sale", "rent"], description: "rent only if the user wants to rent or lease" },
      city: { type: "string", description: "city slug from the provided list" },
      neighborhood: { type: "string", description: "neighbourhood slug from the provided list" },
      priceMin: { type: "integer", description: "minimum price in dollars (monthly rent for rentals)" },
      priceMax: { type: "integer", description: "maximum price in dollars (monthly rent for rentals)" },
      bedsMin: { type: "number", description: "minimum bedrooms, 0 for a studio" },
      bathsMin: { type: "number" },
      propertyTypes: { type: "array", items: { type: "string", enum: PROPERTY_TYPES }, description: "apartments and lofts are condo; houses are detached" },
      sqftMin: { type: "integer", description: "minimum interior size in square feet" },
      sqftMax: { type: "integer" },
      yearBuiltMin: { type: "integer" },
      daysOnMarketMax: { type: "integer", description: "7 for listed this week, 1 for today" },
      keywords: { type: "string", description: "amenities to look for in descriptions, like pool or balcony" },
      parking: { type: "boolean" },
      pets: { type: "boolean", description: "rentals only" },
      furnished: { type: "boolean", description: "rentals only" },
      laundry: { type: "boolean", description: "in suite laundry, rentals only" },
      sort: { type: "string", enum: SORTS },
    },
    additionalProperties: false,
  },
} as const;

export async function parseQueryAnthropic(text: string, ctx: ParseContext, apiKey: string, signal?: AbortSignal): Promise<SearchParamsInput> {
  const places = [
    `Cities: ${ctx.cities.map((c) => `${c.name} (${c.slug})`).join(", ")}.`,
    ctx.neighborhoods?.length ? `Neighbourhoods: ${ctx.neighborhoods.map((n) => `${n.name} (${n.slug}, city ${n.citySlug})`).join(", ")}.` : "",
  ].join("\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 400,
      system: `You turn a home search request into filters for a Canadian real estate site. Prices are in dollars; "900k" is 900000. Use only these places:\n${places}`,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: text }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const body = (await res.json()) as { content: { type: string; name?: string; input?: SearchParamsInput }[] };
  const call = body.content.find((c) => c.type === "tool_use" && c.name === TOOL.name);
  if (!call?.input) throw new Error("No filters in the model response");
  return call.input;
}
