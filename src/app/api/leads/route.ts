import { auth } from "@/lib/auth";
import { LeadInput } from "@/lib/leads/schema";
import { leadViewToken } from "@/lib/leads/token";
import { verifyTurnstile } from "@/lib/turnstile";
import { fail, invalid, ok } from "@/server/api/respond";
import { clientIp, rateLimit, rateLimitWrite } from "@/server/api/rate-limit";
import { createLead, leadGuard } from "@/server/data/leads";
import { trackServer } from "@/lib/analytics/server";
import { sqlClient } from "@/db";

/** docs/02 POST /api/leads: any lead type, captcha protected in production. Routing runs in route_lead. */
export async function POST(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const limited = rateLimit(req);
  if (limited) return limited;
  const parsed = LeadInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  if (!(await verifyTurnstile(parsed.data.turnstileToken, clientIp(req)))) {
    return fail(400, { code: "captcha_failed", message: "Please complete the check that you are not a robot." });
  }
  const guard = await leadGuard(parsed.data);
  if (guard && "limited" in guard) {
    return fail(429, { code: "too_many_leads", message: "You have sent a lot of requests today. Try again tomorrow, or reply to the agent who contacted you." });
  }
  const session = await auth();
  // The same request again: confirm it without sending the agent a second lead. The status token (who
  // the lead went to) is only handed back to the signed in person who sent it, not to anyone who knows
  // their email address.
  if (guard) {
    const [own] = session?.user?.id
      ? await sqlClient<{ id: string }[]>`select id from leads where id = ${guard.duplicateOf} and consumer_user_id = ${session.user.id}`
      : [];
    return ok({ leadId: guard.duplicateOf, statusToken: own ? leadViewToken(own.id) : "", duplicate: true }, {}, { status: 200 });
  }
  const lead = await createLead(parsed.data, session?.user?.id ?? null);
  const [place] = parsed.data.listingId
    ? await sqlClient<{ city: string | null }[]>`select r.slug as city from listings l left join regions r on r.id = l.city_region_id where l.id = ${parsed.data.listingId}`
    : [];
  await trackServer("lead_submit", { leadType: parsed.data.leadType, listingId: parsed.data.listingId ?? null, city: place?.city ?? null }, session?.user?.id ?? null);
  // The status token lets this browser see who the lead went to, without an account.
  return ok({ leadId: lead.id, statusToken: leadViewToken(lead.id) }, {}, { status: 201 });
}
