import { auth } from "@/lib/auth";
import { LeadInput } from "@/lib/leads/schema";
import { invalid, ok } from "@/server/api/respond";
import { rateLimit } from "@/server/api/rate-limit";
import { createLead } from "@/server/data/leads";

/** docs/02 POST /api/leads: any lead type. Routing runs in the route_lead job. */
export async function POST(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const parsed = LeadInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const session = await auth();
  const lead = await createLead(parsed.data, session?.user?.id ?? null);
  return ok({ leadId: lead.id }, {}, { status: 201 });
}
