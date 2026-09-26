import "dotenv/config";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { sqlClient as sql } from "@/db";
import { sendDueAlerts } from "@/lib/alerts/send";
import { devMailFile } from "@/lib/email";

// docs/05 Phase 6 criterion 1: the daily alert sends exactly once per saved search with new
// matches, checked with a test clock. Run with the log email transport.

async function main() {
  process.env.EMAIL_TRANSPORT = "log";
  const email = `alerts-check-${Date.now()}@example.com`;
  const [user] = await sql<{ id: string }[]>`insert into users (email, name) values (${email}, 'Alert Check') returning id`;
  const mk = (name: string, filters: object) => sql<{ id: string }[]>`
    insert into saved_searches (user_id, name, filters, alert_frequency, last_seen_listing_at)
    values (${user.id}, ${name}, ${sql.json(filters as never)}, 'daily', '2000-01-01') returning id`;
  const [withMatches] = await mk("Condos in Los Angeles", { type: "sale", city: "los-angeles", propertyTypes: ["condo"] });
  const [empty] = await mk("Nothing matches", { type: "sale", city: "los-angeles", priceMax: 1 });
  const ids = [withMatches.id, empty.id];
  const file = devMailFile(email);
  rmSync(file, { force: true });

  const failures: string[] = [];
  const check = (ok: boolean, what: string) => (ok ? console.log(`ok   ${what}`) : (failures.push(what), console.log(`FAIL ${what}`)));

  try {
    const t0 = new Date();
    // Two schedulers firing at once in the same window: exactly one email.
    const [a, b] = await Promise.all([sendDueAlerts("daily", t0, { savedSearchIds: ids }), sendDueAlerts("daily", t0, { savedSearchIds: ids })]);
    check(a.sent + b.sent === 1, `concurrent runs in one window send once (sent ${a.sent + b.sent})`);
    check(a.noMatches + b.noMatches >= 2, "a saved search with no new matches is skipped");
    const later = await sendDueAlerts("daily", new Date(t0.getTime() + 60 * 60_000), { savedSearchIds: ids });
    check(later.sent === 0, "a rerun later the same day sends nothing");
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from alert_sends where saved_search_id = any(${ids}::uuid[])`;
    check(n === 1, `alert_sends has exactly one row (${n})`);
    const mail = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { subject: string; html: string; text: string }) : null;
    check(!!mail && /^\d+ new homes? in Condos in Los Angeles$/.test(mail.subject), `email subject "${mail?.subject}"`);
    check(!!mail && (mail.html.match(/utm_source=alert/g)?.length ?? 0) >= 2 && mail.html.includes("/alerts/unsubscribe?id="), "email has listing links with utm and an unsubscribe link");
    // Next day, nothing new since the last send: skipped.
    const nextDay = await sendDueAlerts("daily", new Date(t0.getTime() + 24 * 60 * 60_000), { savedSearchIds: ids });
    check(nextDay.sent === 0 && nextDay.noMatches === 2, "next day without new listings sends nothing");
  } finally {
    await sql`delete from users where id = ${user.id}`;
    rmSync(file, { force: true });
    await sql.end();
  }
  console.log(`alerts: ${failures.length ? `FAIL (${failures.length})` : "PASS"}, daily alert sent exactly once`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
