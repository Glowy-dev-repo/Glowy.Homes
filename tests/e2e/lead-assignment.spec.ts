import { COVERED_ZIP, db } from "./support/db";
import { expect, test } from "./support/fixtures";
import { signInAs } from "./support/auth";

// The live default: every lead waits for Glowy Homes, which chooses the agent. The gate's server runs
// automatic assignment for the routing suites, so this lead starts in the state routing leaves a lead in
// when Glowy Homes chooses (tests/unit/lead-assignment.test.ts covers that step).
test("a lead waiting for Glowy Homes shows the suggested agent and admin assigns it", async ({ page, isMobile }) => {
  test.skip(isMobile, "admin desktop flow");
  const [home] = await db()<{ listingId: string; propertyId: string; proId: string }[]>`
    select l.id as "listingId", l.property_id as "propertyId",
      (select z.pro_id from pro_zip_codes z join pros pr on pr.id = z.pro_id
        where z.zip = left(p.postal_code, 5) and pr.status = 'active' and pr.pro_type = 'agent' and pr.is_accepting_leads order by pr.id limit 1) as "proId"
    from listings l join properties p on p.id = l.property_id
    where l.source = 'synthetic' and l.listing_type = 'sale' and l.status = 'active' and l.owner_user_id is null and ${db().unsafe(COVERED_ZIP)}
    order by l.id limit 1`;
  const entry = { at: new Date().toISOString(), action: "awaiting_admin", reason: "waiting for Glowy Homes to choose", suggested_pro_id: home.proId };
  const [lead] = await db()<{ id: string }[]>`
    insert into leads (lead_type, consumer_name, consumer_email, listing_id, property_id, payload, status, routing_log)
    values ('tour', 'Assign Test', ${`assign-${Date.now()}@example.com`}, ${home.listingId}, ${home.propertyId}, '{}'::jsonb, 'new', ${db().json([entry])})
    returning id`;

  await signInAs(page, "admin@example.com", `/admin/leads?lead=${lead.id}`);

  const row = page.locator(`[data-lead-id="${lead.id}"]`).first();
  await expect(row).toContainText("waiting for an agent");
  await expect(row.getByTestId("suggested-agent")).toContainText("Suggested:");
  const form = row.getByTestId("reassign-form");
  await expect(form.getByRole("combobox")).toHaveValue(home.proId);
  await form.getByRole("button", { name: "Assign" }).click();

  const assigned = async () =>
    (await db()<{ pro: string | null; last: { action: string } }[]>`
      select assigned_pro_id as pro, routing_log -> -1 as last from leads where id = ${lead.id}`)[0];
  await expect.poll(async () => (await assigned()).pro, { timeout: 20_000 }).toBe(home.proId);
  expect((await assigned()).last.action).toBe("admin_reassigned");
  // It now shows its agent.
  await page.goto(`/admin/leads?lead=${lead.id}`);
  await expect(page.locator(`[data-lead-id="${lead.id}"]`).first()).toContainText("with ");
});

test("admin closes a spam lead and it leaves the waiting queue", async ({ page, isMobile }) => {
  test.skip(isMobile, "admin desktop flow");
  const [lead] = await db()<{ id: string }[]>`
    insert into leads (lead_type, consumer_name, consumer_email, payload, status)
    values ('contact', 'Spam Bot', ${`spam-${Date.now()}@example.com`}, '{"zip":"93021"}'::jsonb, 'new')
    returning id`;
  await signInAs(page, "admin@example.com", `/admin/leads?lead=${lead.id}`);
  const row = page.locator(`[data-lead-id="${lead.id}"]`).first();
  await row.getByTestId("close-spam").click();
  await expect(row.getByTestId("close-spam")).toHaveText("Yes, close as spam");
  await row.getByTestId("close-spam").click();

  const closed = async () => (await db()<{ status: string; last: { action: string } }[]>`select status, routing_log -> -1 as last from leads where id = ${lead.id}`)[0];
  await expect.poll(async () => (await closed()).status, { timeout: 20_000 }).toBe("lost");
  expect((await closed()).last.action).toBe("admin_closed_spam");
  const [{ waiting }] = await db()<{ waiting: boolean }[]>`select ${lead.id}::uuid in (select id from leads where assigned_pro_id is null and status in ('new', 'unassigned')) as waiting`;
  expect(waiting).toBe(false);
});
