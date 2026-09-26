import { brand } from "@/config/brand";
import { sqlClient } from "@/db";
import { sendEmail } from "@/lib/email";
import { savedSearchAlertEmail, type AlertCard } from "@/lib/email/templates/saved-search-alert";
import { mediaUrl } from "@/lib/media/urls";
import { newListingMatches } from "@/lib/search/postgres";
import { toQueryString } from "@/lib/search/url";
import { addressSlug } from "@/lib/slug";
import { SearchParams } from "@/types/search";
import { unsubscribeToken } from "./token";
import { alertPeriodKey, MAX_ALERT_CARDS, type AlertFrequency } from "./window";

// send_saved_search_alerts (docs/03 section 6). Skips searches with no new matches; the
// alert_sends unique key guarantees at most one email per saved search per frequency window.

const sql = sqlClient;
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? `https://${brand.domain}`;
const UTM = "utm_source=alert&utm_medium=email&utm_campaign=saved_search";
const FREQUENCY_LABEL: Record<AlertFrequency, string> = { instant: "instant", daily: "daily", weekly: "weekly" };

export type AlertRunResult = { considered: number; sent: number; noMatches: number; alreadySent: number; failed: number };

type Due = { id: string; name: string; filters: Record<string, unknown>; email: string; since: Date };

export async function sendDueAlerts(frequency: AlertFrequency, now: Date = new Date(), opts: { savedSearchIds?: string[] } = {}): Promise<AlertRunResult> {
  const due = await sql<Due[]>`
    select s.id, s.name, s.filters, u.email, coalesce(s.last_seen_listing_at, s.created_at) as since
    from saved_searches s join users u on u.id = s.user_id
    where s.alert_frequency = ${frequency} and u.email is not null
      ${opts.savedSearchIds ? sql`and s.id = any(${opts.savedSearchIds}::uuid[])` : sql``}
    order by s.id`;

  const result: AlertRunResult = { considered: due.length, sent: 0, noMatches: 0, alreadySent: 0, failed: 0 };
  const periodKey = alertPeriodKey(frequency, now);
  for (const s of due) {
    try {
      const outcome = await sendOne(s, frequency, periodKey, now);
      result[outcome] += 1;
    } catch (e) {
      result.failed += 1;
      console.error(`[alerts] saved search ${s.id} failed`, e);
    }
  }
  return result;
}

async function sendOne(s: Due, frequency: AlertFrequency, periodKey: string, now: Date): Promise<"sent" | "noMatches" | "alreadySent"> {
  const parsed = SearchParams.safeParse(s.filters);
  if (!parsed.success) return "noMatches";
  const params = { ...parsed.data, page: 1 };
  const { items, total } = await newListingMatches(params, new Date(s.since), now, MAX_ALERT_CARDS);
  if (total === 0) return "noMatches";

  const base = appUrl();
  const cards: AlertCard[] = items.map((l) => ({
    href: `${base}/listing/${l.id}/${addressSlug(l.addressLine1, l.addressLine2, l.city)}?${UTM}`,
    photoUrl: l.coverKey ? absolute(base, mediaUrl(l.coverKey, 400)) : null,
    price: l.price,
    listingType: l.listingType,
    beds: l.beds,
    baths: l.baths,
    address: [l.addressLine2, l.addressLine1].filter(Boolean).join(" ") + `, ${l.city}`,
  }));
  const token = unsubscribeToken(s.id);
  // The link opens a confirmation page (link scanners must not unsubscribe anyone); mail clients
  // use the one click POST endpoint from the List-Unsubscribe header (RFC 8058).
  const unsubscribeHref = `${base}/alerts/unsubscribe?id=${s.id}&token=${token}`;
  const oneClickHref = `${base}/api/saved-searches/${s.id}/unsubscribe?token=${token}`;
  const email = await savedSearchAlertEmail({
    searchName: s.name,
    total,
    cards,
    searchHref: `${base}/search?${toQueryString(params)}${toQueryString(params) ? "&" : ""}${UTM}`,
    unsubscribeHref,
    frequencyLabel: FREQUENCY_LABEL[frequency],
  });

  // Claim the window right before sending: a concurrent or repeated run for the same window stops here.
  const [claimed] = await sql`
    insert into alert_sends (saved_search_id, period_key, listing_count) values (${s.id}, ${periodKey}, ${total})
    on conflict (saved_search_id, period_key) do nothing returning id`;
  if (!claimed) return "alreadySent";

  try {
    await sendEmail({
      to: s.email,
      ...email,
      headers: { "List-Unsubscribe": `<${oneClickHref}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });
  } catch (e) {
    // Release the window so a retry can send it.
    await sql`delete from alert_sends where id = ${claimed.id}`;
    throw e;
  }
  await sql`update saved_searches set last_alert_at = ${now}, last_seen_listing_at = ${now} where id = ${s.id}`;
  return "sent";
}

function absolute(base: string, url: string): string {
  return url.startsWith("http") ? url : `${base}${url}`;
}
