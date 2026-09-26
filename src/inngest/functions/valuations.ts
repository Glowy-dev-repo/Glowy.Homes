import { z } from "zod";
import { sqlClient } from "@/db";
import { nightlyScope, refreshValuations, scoreRecentSales } from "@/lib/valuation/engine";
import { inngest } from "../client";

/** refresh_valuations (docs/03 section 3.3): nightly at 02:00 Toronto time, or for given properties. */
export const refreshValuationsFn = inngest.createFunction(
  {
    id: "refresh-valuations",
    concurrency: { limit: 1 },
    retries: 2,
    triggers: [{ cron: "TZ=America/Toronto 0 2 * * *" }, { event: "valuation/refresh.requested" }],
  },
  async ({ event, step }) => {
    const ids = z.object({ propertyIds: z.array(z.string().uuid()).max(5000).optional() }).parse(event.data ?? {}).propertyIds;
    const scope = ids ?? (await step.run("scope", () => nightlyScope(sqlClient)));
    // Chunked so each step stays well inside serverless time limits and retries only what failed.
    const chunk = 2000;
    let valued = 0;
    for (let i = 0; i < scope.length; i += chunk) {
      const r = await step.run(`value-${i}`, () => refreshValuations(sqlClient, scope.slice(i, i + chunk), { refreshIndex: !ids && i === 0 }));
      valued += r.valued;
    }
    return { valued };
  },
);

/** score_valuations (docs/03 section 3.4): nightly accuracy against the day's sales. */
export const scoreValuationsFn = inngest.createFunction(
  { id: "score-valuations", triggers: [{ cron: "TZ=America/Toronto 30 2 * * *" }] },
  async ({ step }) => ({ scored: await step.run("score", () => scoreRecentSales(sqlClient)) }),
);

/** A comp sale within 1 km refreshes nearby listed and claimed homes (docs/03 section 3.3). */
export const nearbySaleFn = inngest.createFunction(
  { id: "valuations-after-nearby-sale", triggers: [{ event: "valuation/nearby-sales" }] },
  async ({ event, step }) => {
    const soldIds = z.object({ propertyIds: z.array(z.string().uuid()).max(2000) }).parse(event.data).propertyIds;
    const nearby = await step.run("find", async () =>
      (
        await sqlClient<{ id: string }[]>`
          select distinct p.id from properties p
          join properties s on s.id = any(${soldIds}::uuid[]) and ST_DWithin(p.location, s.location, 1000)
          where p.id <> all(${soldIds}::uuid[])
            and (p.owner_claimed_at is not null or exists (select 1 from listings l where l.property_id = p.id and l.status = 'active'))
          limit 5000`
      ).map((r) => r.id),
    );
    if (nearby.length) await step.sendEvent("refresh", { name: "valuation/refresh.requested", data: { propertyIds: nearby } });
    return { nearby: nearby.length };
  },
);
