import { sqlClient } from "@/db";
import { auth } from "@/lib/auth";
import { isUuid } from "@/lib/listings/detail";
import { verifyLeadViewToken } from "@/lib/leads/token";
import { fail, ok } from "@/server/api/respond";

/**
 * Who a lead was assigned to, for the person who submitted it (status token or their session).
 * Only the pro's public details: name, photo, brokerage (docs/05 Phase 4 criterion 5).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notFound = fail(404, { code: "not_found", message: "Lead not found." });
  if (!isUuid(id)) return notFound;
  const token = new URL(req.url).searchParams.get("token");
  const [row] = await sqlClient<{ status: string; consumer: string | null; name: string | null; photo: string | null; brokerage: string | null; slug: string | null }[]>`
    select ld.status, ld.consumer_user_id as consumer, pr.display_name as name, pr.photo_url as photo, pr.brokerage_name as brokerage, pr.slug
    from leads ld left join pros pr on pr.id = ld.assigned_pro_id where ld.id = ${id}`;
  if (!row) return notFound;
  const session = verifyLeadViewToken(id, token) ? null : await auth();
  if (!verifyLeadViewToken(id, token) && (!session?.user?.id || session.user.id !== row.consumer)) return notFound;
  return ok({ status: row.status, pro: row.name ? { name: row.name, photoUrl: row.photo, brokerage: row.brokerage, slug: row.slug } : null });
}
