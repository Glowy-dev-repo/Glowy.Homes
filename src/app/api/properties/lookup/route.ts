import { z } from "zod";
import { sqlClient } from "@/db";
import { lookupProperty } from "@/lib/properties/lookup";
import { fail, invalid, ok } from "@/server/api/respond";
import { rateLimit } from "@/server/api/rate-limit";

const Query = z.object({ address: z.string().trim().min(5, "Enter a full street address.").max(200) });

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const parsed = Query.safeParse({ address: new URL(req.url).searchParams.get("address") ?? "" });
  if (!parsed.success) return invalid(parsed.error);

  const result = await lookupProperty(sqlClient, parsed.data.address);
  if (!result.ok) return fail(result.reason === "unparseable" ? 400 : 404, { code: result.reason, message: result.message });
  return ok({ propertyId: result.propertyId, slug: result.slug, created: result.created, href: `/home-value/${result.propertyId}/${result.slug}` });
}
