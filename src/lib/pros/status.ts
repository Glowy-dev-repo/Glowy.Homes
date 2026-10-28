import type postgres from "postgres";
import { brand } from "@/config/brand";
import type { ProStatus, ProStatusLogEntry } from "@/db/schema/agents";
import { sendEmail } from "@/lib/email";
import { adminNewAgentEmail, proApplicationReceivedEmail, proApprovedEmail, proNotApprovedEmail, proSuspendedEmail } from "@/lib/email/templates/pros";
import { revalidateSitePage } from "@/lib/revalidate";
import { nextProStatus, type ProStatusAction } from "./status-rules";

type Sql = postgres.Sql | postgres.TransactionSql;

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? `https://${brand.domain}`;

export type SetProStatusResult =
  | { ok: true; status: ProStatus; openLeadIds: string[] }
  | { ok: false; code: "not_found" | "bad_transition" | "license_taken" };

/**
 * The one way an agent's status changes (approve, reject, suspend, reactivate). Guarded by the current
 * status so two admins acting at once cannot both apply, recorded in pros.status_log, emailed to the
 * agent, and reflected on the public pages at once. requirePro reads the status from the database on
 * every request, so a suspended agent loses lead access on their next request.
 */
export async function setProStatus(sql: Sql, proId: string, action: ProStatusAction, opts: { adminUserId: string | null; reason: string | null }): Promise<SetProStatusResult> {
  const [pro] = await sql<{ status: ProStatus; name: string; slug: string; email: string }[]>`
    select p.status, p.display_name as name, p.slug, u.email from pros p join users u on u.id = p.user_id where p.id = ${proId}`;
  if (!pro) return { ok: false, code: "not_found" };
  const next = nextProStatus(pro.status, action);
  if (!next) return { ok: false, code: "bad_transition" };

  const entry: ProStatusLogEntry = { at: new Date().toISOString(), from: pro.status, to: next, action, reason: opts.reason, admin_user_id: opts.adminUserId };
  let updated: { id: string }[];
  try {
    updated = await sql<{ id: string }[]>`
      update pros set status = ${next},
        license_verified_at = case when ${action} = 'approve' then now() else license_verified_at end,
        status_log = status_log || ${sql.json([entry] as never)}, updated_at = now()
      where id = ${proId} and status = ${pro.status}
      returning id`;
  } catch (e) {
    // Approving or reactivating an agent whose license another working account now holds.
    if ((e as { code?: string; constraint_name?: string }).code === "23505" && (e as { constraint_name?: string }).constraint_name === "pros_agent_license_key") {
      return { ok: false, code: "license_taken" };
    }
    throw e;
  }
  if (!updated.length) return { ok: false, code: "bad_transition" };

  await sql`
    update moderation_items set status = ${next === "active" ? "approved" : "rejected"}, reviewer_user_id = ${opts.adminUserId},
      decision_note = ${opts.reason}, resolved_at = now()
    where item_type = 'pro' and item_id = ${proId} and status = 'open'`;
  const open = await sql<{ id: string }[]>`
    select id from leads where assigned_pro_id = ${proId} and status not in ('closed', 'lost') order by assigned_at desc`;

  const email =
    next === "active"
      ? proApprovedEmail({ appUrl: appUrl(), name: pro.name, slug: pro.slug })
      : action === "reject"
        ? proNotApprovedEmail({ appUrl: appUrl(), name: pro.name, reason: opts.reason })
        : proSuspendedEmail({ appUrl: appUrl(), name: pro.name, reason: opts.reason });
  await sendEmail({ to: pro.email, ...email }).catch((e) => console.warn(`[pros] status email failed: ${e}`));

  try {
    revalidateSitePage("/agent/[slug]", "page");
    revalidateSitePage("/agents/[city]", "page");
  } catch {
    // Outside a request (scripts, background jobs) there is no page cache to clear.
  }
  return { ok: true, status: next, openLeadIds: open.map((l) => l.id) };
}

/** A new agent applied: thank them, and tell every admin there is an application to check. */
export async function notifyNewApplication(sql: Sql, proId: string): Promise<void> {
  const [pro] = await sql<{ name: string; email: string; license: string | null; zips: string[] }[]>`
    select p.display_name as name, u.email, p.license_number as license,
      coalesce(array(select zip from pro_zip_codes where pro_id = p.id order by zip), '{}') as zips
    from pros p join users u on u.id = p.user_id where p.id = ${proId}`;
  if (!pro) return;
  await sendEmail({ to: pro.email, ...proApplicationReceivedEmail({ appUrl: appUrl(), name: pro.name }) }).catch((e) => console.warn(`[pros] application email failed: ${e}`));
  const admins = await sql<{ email: string }[]>`select email from users where 'admin' = any(roles)`;
  for (const a of admins) {
    await sendEmail({ to: a.email, ...adminNewAgentEmail({ appUrl: appUrl(), proId, name: pro.name, license: pro.license, zips: pro.zips }) }).catch(() => {});
  }
}
