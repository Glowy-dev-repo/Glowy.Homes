import "dotenv/config";
import { brand } from "@/config/brand";
import { nlProvider, parseNaturalQuery } from "@/lib/nl-search";
import { NL_FIXTURES, normalizeParams } from "../fixtures/nl-search";

// docs/05 Phase 6 criterion 2: at least 9 of 10 fixture queries parse to the expected SearchParams,
// using whichever provider is configured (the Anthropic API with a key, else the rule parser).

async function main() {
  let correct = 0;
  for (const f of NL_FIXTURES) {
    const { params, provider } = await parseNaturalQuery(f.text, { cities: brand.market.cities });
    const got = normalizeParams(params);
    const ok = JSON.stringify(got) === JSON.stringify(normalizeParams(f.expected));
    if (ok) correct += 1;
    console.log(`${ok ? "ok  " : "MISS"} [${provider}] ${f.text}${ok ? "" : `\n     got ${JSON.stringify(got)}`}`);
  }
  console.log(`nl-search: ${correct}/${NL_FIXTURES.length} correct with the ${nlProvider()} provider`);
  process.exit(correct >= 9 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
