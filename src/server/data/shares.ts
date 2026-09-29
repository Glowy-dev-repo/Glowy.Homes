import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { brand } from "@/config/brand";
import { sqlClient } from "@/db";
import { sendEmail } from "@/lib/email";
import { createRateLimiter } from "@/server/api/rate-limit";
import { shareInviteEmail } from "@/lib/email/templates/share";
import { coverJoin, summaryColumns } from "@/lib/search/postgres";
import type { ListingSummary } from "@/types/search";

// Shared saved homes list with a cobuyer (docs/05 Phase 6 task 4). The owner invites by email; once
// the invitee accepts (signed in with that email), both see each other's saved homes in one list.

const sql = sqlClient;
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? `https://${brand.domain}`;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export const MAX_SHARES = 3;

export type ShareRow = { id: string; direction: "sent" | "received"; email: string; name: string | null; accepted: boolean; createdAt: string };

export type InviteResult = "sent" | "self" | "limit" | "already_shared" | "too_soon" | "daily_limit";

// Invitation emails per account per day, however invites are added, removed or re-sent: stops the
// share feature being used to mail strangers.
const invitesPerDay = createRateLimiter(10 / (24 * 60), Date.now, 10);

export async function inviteCobuyer(ownerId: string, rawEmail: string): Promise<InviteResult> {
  const email = rawEmail.trim().toLowerCase();
  const [owner] = await sql<{ email: string; name: string | null }[]>`select email, name from users where id = ${ownerId}`;
  if (owner.email.toLowerCase() === email) return "self";
  const [existing] = await sql<{ id: string; accepted: boolean }[]>`
    select id, accepted_at is not null as accepted from saved_home_shares where owner_user_id = ${ownerId} and invitee_email = ${email}`;
  if (existing?.accepted) return "already_shared";
  if (existing) {
    const [{ recent }] = await sql<{ recent: boolean }[]>`select created_at > now() - interval '1 hour' as recent from saved_home_shares where id = ${existing.id}`;
    if (recent) return "too_soon";
  }
  if (!existing) {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from saved_home_shares where owner_user_id = ${ownerId}`;
    if (n >= MAX_SHARES) return "limit";
  }
  if (!invitesPerDay(ownerId)) return "daily_limit";
  // A fresh token on every (re)invite; only its hash is stored.
  const token = randomBytes(24).toString("base64url");
  await sql`
    insert into saved_home_shares (owner_user_id, invitee_email, token_hash) values (${ownerId}, ${email}, ${hash(token)})
    on conflict (owner_user_id, invitee_email) do update set token_hash = excluded.token_hash, created_at = now()`;
  const href = `${appUrl()}/account/shared/accept?token=${token}`;
  await sendEmail({ to: email, ...shareInviteEmail({ inviterName: owner.name ?? owner.email.split("@")[0], href }) });
  return "sent";
}

export type PendingInvite = { id: string; inviterName: string; inviteeEmail: string };

export async function inviteByToken(token: string): Promise<PendingInvite | null> {
  const [row] = await sql<PendingInvite[]>`
    select s.id, coalesce(u.name, u.email) as "inviterName", s.invitee_email as "inviteeEmail"
    from saved_home_shares s join users u on u.id = s.owner_user_id
    where s.token_hash = ${hash(token)} and s.accepted_at is null and s.created_at > now() - interval '14 days'`;
  return row ?? null;
}

export type AcceptResult = "accepted" | "invalid" | "wrong_account" | "own_invite";

export async function acceptInvite(userId: string, userEmail: string, token: string): Promise<AcceptResult> {
  const [row] = await sql<{ id: string; owner: string; email: string }[]>`
    select id, owner_user_id as owner, invitee_email as email from saved_home_shares
    where token_hash = ${hash(token)} and accepted_at is null and created_at > now() - interval '14 days'`;
  if (!row) return "invalid";
  if (row.owner === userId) return "own_invite";
  // The link only works for the invited address, so a forwarded email does not grant access.
  if (row.email !== userEmail.toLowerCase()) return "wrong_account";
  await sql`update saved_home_shares set invitee_user_id = ${userId}, accepted_at = now() where id = ${row.id}`;
  return "accepted";
}

export async function shares(userId: string): Promise<ShareRow[]> {
  return sql<ShareRow[]>`
    select s.id, 'sent' as direction, s.invitee_email as email, iu.name, s.accepted_at is not null as accepted, s.created_at::text as "createdAt"
    from saved_home_shares s left join users iu on iu.id = s.invitee_user_id
    where s.owner_user_id = ${userId}
    union all
    select s.id, 'received', ou.email, ou.name, true, s.created_at::text
    from saved_home_shares s join users ou on ou.id = s.owner_user_id
    where s.invitee_user_id = ${userId} and s.accepted_at is not null
    order by 6 desc`;
}

/** Either side can end a share, or the owner can cancel a pending invite. */
export async function removeShare(userId: string, shareId: string): Promise<boolean> {
  const rows = await sql`delete from saved_home_shares where id = ${shareId} and (owner_user_id = ${userId} or invitee_user_id = ${userId}) returning id`;
  return rows.length > 0;
}

export type SharedHome = ListingSummary & { savedBy: string[]; savedByMe: boolean };

/** Saved homes of the user and everyone they share with, one row per home. */
export async function sharedHomes(userId: string): Promise<SharedHome[]> {
  return sql<SharedHome[]>`
    with members as (
      select ${userId}::uuid as user_id
      union select invitee_user_id from saved_home_shares where owner_user_id = ${userId} and accepted_at is not null
      union select owner_user_id from saved_home_shares where invitee_user_id = ${userId} and accepted_at is not null
    ),
    saved as (
      select sh.listing_id, max(sh.created_at) as saved_at,
        array_agg(distinct case when sh.user_id = ${userId}::uuid then 'You' else coalesce(u.name, u.email) end) as saved_by,
        bool_or(sh.user_id = ${userId}::uuid) as saved_by_me
      from saved_homes sh join members m on m.user_id = sh.user_id join users u on u.id = sh.user_id
      group by sh.listing_id
    )
    select ${summaryColumns(sql)}, s.saved_by as "savedBy", s.saved_by_me as "savedByMe"
    from saved s
    join listings l on l.id = s.listing_id
    join properties p on p.id = l.property_id
    ${coverJoin(sql)}
    order by s.saved_at desc
    limit 200`;
}
