import "server-only";
import { brand } from "@/config/brand";
import { sqlClient } from "@/db";
import { sendEmail } from "@/lib/email";
import { proInviteEmail } from "@/lib/email/templates/pros";
import type { AgentInvite } from "@/lib/pros/invite";

const sql = sqlClient;
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? `https://${brand.domain}`;

/** Sends (or sends again) an invite. Someone who already has a partner account is not invited. */
export async function inviteAgent(input: AgentInvite, adminUserId: string): Promise<{ status: "invited" } | { status: "already_partner" }> {
  const [existing] = await sql<{ id: string }[]>`
    select p.id from pros p join users u on u.id = p.user_id where lower(u.email) = ${input.email} limit 1`;
  if (existing) return { status: "already_partner" };
  await sql`
    insert into pro_invites (email, name, invited_by) values (${input.email}, ${input.name ?? null}, ${adminUserId})
    on conflict ((lower(email))) do update set created_at = now(), invited_by = excluded.invited_by,
      name = coalesce(excluded.name, pro_invites.name)`;
  const [admin] = await sql<{ name: string | null }[]>`select name from users where id = ${adminUserId}`;
  await sendEmail({ to: input.email, ...proInviteEmail({ appUrl: appUrl(), name: input.name ?? null, inviterName: admin?.name ?? brand.name }) });
  return { status: "invited" };
}

export type InviteRow = { id: string; email: string; name: string | null; createdAt: string; joinedProId: string | null };

export async function recentInvites(limit = 10): Promise<InviteRow[]> {
  return sql<InviteRow[]>`
    select id, email, name, created_at::text as "createdAt", accepted_pro_id as "joinedProId"
    from pro_invites order by created_at desc limit ${limit}`;
}
