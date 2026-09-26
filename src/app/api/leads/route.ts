import { auth } from "@/lib/auth";
import { LeadInput } from "@/lib/leads/schema";
import { leadViewToken } from "@/lib/leads/token";
import { verifyTurnstile } from "@/lib/turnstile";
import { fail, invalid, ok } from "@/server/api/respond";
import { clientIp, rateLimit } from "@/server/api/rate-limit";
import { createLead } from "@/server/data/leads";

/** docs/02 POST /api/leads: any lead type, captcha protected in production. Routing runs in route_lead. */
export async function POST(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const parsed = LeadInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  if (!(await verifyTurnstile(parsed.data.turnstileToken, clientIp(req)))) {
    return fail(400, { code: "captcha_failed", message: "Please complete the check that you are not a robot." });
  }
  const session = await auth();
  const lead = await createLead(parsed.data, session?.user?.id ?? null);
  // The status token lets this browser see who the lead went to, without an account.
  return ok({ leadId: lead.id, statusToken: leadViewToken(lead.id) }, {}, { status: 201 });
}
