import { signIn } from "./support/auth";
import { COVERED_ZIP, db, sampleListingPath } from "./support/db";
import { expect, test } from "./support/fixtures";
import { uniqueEmail, waitForEmailLink } from "./support/mail";

// Lead routing needs the Inngest dev server; the phase gate starts it next to the test build.

async function waitForAssignment(leadWhere: { email: string }, timeoutMs = 60_000) {
  let row: { id: string; pro: string | null; status: string } | undefined;
  await expect
    .poll(
      async () => {
        [row] = await db()<{ id: string; pro: string | null; status: string }[]>`
          select id, assigned_pro_id as pro, status from leads where consumer_email = ${leadWhere.email} order by created_at desc limit 1`;
        return row?.pro ?? null;
      },
      { timeout: timeoutMs, intervals: [500, 1000] },
    )
    .not.toBeNull();
  return row!;
}

async function proEmail(proId: string): Promise<string> {
  const [r] = await db()`select u.email from pros p join users u on u.id = p.user_id where p.id = ${proId}`;
  return r.email;
}

/** Signs in as an existing account through the real magic link flow. */
async function signInAs(page: import("@playwright/test").Page, email: string, callbackUrl: string) {
  await page.goto(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign in link" }).click();
  await expect(page).toHaveURL(/check-email/);
  await page.goto(await waitForEmailLink(email));
}

test.describe("lead routing", () => {
  test("a tour request is assigned within 60 seconds and shows in the agent inbox as New", async ({ page, browser, isMobile }) => {
    test.skip(isMobile, "one routing flow per run");
    test.setTimeout(150_000);
    const { path } = await sampleListingPath(`l.listing_type = 'sale' and l.status = 'active' and l.city_region_id = (select id from regions where slug = 'los-angeles' and type = 'city') and ${COVERED_ZIP}`);
    await page.goto(path);
    // The card names the partner agent for this ZIP code; the tour request goes to them.
    const shown = (await page.getByTestId("local-agent-name").textContent())?.trim();
    await page.getByTestId("local-agent").getByRole("button", { name: "Request a tour" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("lead-recipient")).toContainText(/partner agent for ZIP \d{5}, not to the listing agent/);
    const email = uniqueEmail("tour");
    await dialog.getByLabel("Name").fill("Taylor Buyer");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByRole("button", { name: "Video" }).click();
    await dialog.getByRole("button", { name: "Request a tour" }).click();
    await expect(dialog.getByText("Please agree to be contacted")).toBeVisible();
    await dialog.getByRole("checkbox").check();
    const started = Date.now();
    await dialog.getByRole("button", { name: "Request a tour" }).click();
    await expect(dialog.getByTestId("lead-success")).toBeVisible();

    const lead = await waitForAssignment({ email });
    expect(Date.now() - started).toBeLessThan(60_000);
    expect(lead.status).toBe("new");
    const [covers] = await db()`
      select exists (select 1 from pro_zip_codes z join leads ld on ld.id = ${lead.id} join listings l on l.id = ld.listing_id
        join properties p on p.id = l.property_id where z.pro_id = ${lead.pro} and z.zip = left(p.postal_code, 5)) as ok`;
    expect(covers.ok).toBe(true);
    const [assigned] = await db()`select display_name from pros where id = ${lead.pro}`;
    expect(assigned.display_name).toBe(shown);
    const [consent] = await db()`select payload->'consent'->>'version' as v, payload->'tour'->>'mode' as mode from leads where id = ${lead.id}`;
    expect(consent).toMatchObject({ mode: "video" });
    expect(consent.v).toBeTruthy();

    // The assigned agent sees it as New, with the consumer's contact details.
    const agent = await browser.newPage();
    await signInAs(agent, await proEmail(lead.pro!), "/pro/leads");
    const row = agent.locator(`[data-lead-id="${lead.id}"]`);
    await expect(row).toBeVisible();
    await expect(row.getByTestId("lead-status")).toHaveValue("new");
    await row.getByRole("button", { name: "Taylor Buyer" }).click();
    await expect(agent.getByTestId("lead-drawer").getByTestId("lead-email")).toHaveText(email);
    // Responding stops the reassignment timer.
    await agent.getByTestId("lead-drawer").getByLabel("Lead status").selectOption("contacted");
    await expect.poll(async () => (await db()`select first_response_at is not null as r from leads where id = ${lead.id}`)[0].r).toBe(true);
    await agent.close();
  });

  test("an unanswered lead is reassigned after the response window", async ({ request, isMobile }) => {
    test.skip(isMobile, "one timer test per run");
    test.setTimeout(180_000);
    const [listing] = await db()`
      select l.id from listings l where l.status = 'active' and l.listing_type = 'sale'
        and l.city_region_id = (select id from regions where slug = 'san-jose' and type = 'city') order by l.list_date desc limit 1`;
    const email = uniqueEmail("reassign");
    const res = await request.post("/api/leads", {
      data: { leadType: "contact", listingId: listing.id, name: "Riley Quiet", email, consent: true, message: "Is it available?" },
    });
    expect(res.status()).toBe(201);
    const first = await waitForAssignment({ email });
    // LEAD_REASSIGN_SECONDS is 45 in the gate: wait for the no response reassignment.
    await expect
      .poll(async () => (await db()`select routing_log::text as log, assigned_pro_id as pro from leads where id = ${first.id}`)[0], { timeout: 150_000, intervals: [3000] })
      .toMatchObject({ log: expect.stringContaining("reassigned") });
    const [after] = await db()`select assigned_pro_id as pro, routing_log from leads where id = ${first.id}`;
    expect(after.pro).not.toBe(first.pro);
    expect(after.routing_log.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(["assigned", "no_response", "reassigned"]));
  });

  test("the consumer sees the pro; nobody else can read the lead", async ({ page, request, browser, isMobile }) => {
    test.skip(isMobile, "authorization is viewport independent");
    test.setTimeout(120_000);
    const email = await signIn(page, "inquirer", "/");
    const { path } = await sampleListingPath(`l.listing_type = 'sale' and l.status = 'active' and l.city_region_id = (select id from regions where slug = 'san-diego' and type = 'city') and ${COVERED_ZIP}`);
    await page.goto(path);
    await page.getByTestId("local-agent").getByRole("button", { name: /^Ask / }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Casey Signedin");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Send message" }).click();
    const lead = await waitForAssignment({ email });
    const [pro] = await db()`select display_name from pros where id = ${lead.pro}`;

    await page.goto("/account/inquiries");
    await expect(page.getByTestId("inquiry").first().getByTestId("inquiry-pro")).toContainText(pro.display_name);

    // Status endpoint without the token or the owner's session: not found.
    expect((await request.get(`/api/leads/${lead.id}/status`)).status()).toBe(404);
    // Another pro cannot open it.
    const [other] = await db()`select u.email from pros p join users u on u.id = p.user_id where p.id <> ${lead.pro} and p.status = 'active' and p.pro_type = 'agent' limit 1`;
    const otherPage = await browser.newPage();
    await signInAs(otherPage, other.email, "/pro/leads");
    const res = await otherPage.request.get(`/api/pro/leads/${lead.id}`);
    expect(res.status()).toBe(404);
    expect(await res.text()).not.toContain(email);
    expect((await otherPage.request.get(`/api/leads/${lead.id}/messages`)).status()).toBe(404);
    await otherPage.close();
  });

  test("a question goes to the best suited agent for the home's ZIP code", async ({ page, isMobile }) => {
    test.skip(isMobile, "one flow per run");
    test.setTimeout(90_000);
    // A home whose ZIP code has an agent whose price range fits it, so the best suited agent is known.
    const [home] = await db()<{ id: string; zip: string }[]>`
      select l.id, left(p.postal_code, 5) as zip from listings l join properties p on p.id = l.property_id
      where l.listing_type = 'sale' and l.status = 'active' and l.internet_display
        and exists (select 1 from pro_zip_codes z join pros pr on pr.id = z.pro_id
          where z.zip = left(p.postal_code, 5) and pr.status = 'active' and pr.is_accepting_leads
            and pr.price_min is not null and l.price between pr.price_min and coalesce(pr.price_max, 2147483647))
      order by l.list_date desc limit 1`;
    const { path } = await sampleListingPath(`l.id = '${home.id}'`);
    await page.goto(path);
    const shown = (await page.getByTestId("local-agent-name").textContent())?.trim();
    await page.getByTestId("local-agent").getByRole("button", { name: /^Ask / }).click();
    const dialog = page.getByRole("dialog");
    const email = uniqueEmail("zipmatch");
    await dialog.getByLabel("Name").fill("Alex Asker");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Send message" }).click();
    const lead = await waitForAssignment({ email });
    const [pro] = await db()<{ zip: boolean; fits: boolean; type: string }[]>`
      select exists (select 1 from pro_zip_codes z where z.pro_id = pr.id and z.zip = ${home.zip}) as zip,
        (select l.price from listings l where l.id = ${home.id}) between coalesce(pr.price_min, 0) and coalesce(pr.price_max, 2147483647) as fits,
        pr.pro_type as type
      from pros pr where pr.id = ${lead.pro}`;
    expect(pro).toMatchObject({ zip: true, fits: true, type: "agent" });
    // The agent on the listing's card is the one the question reached.
    expect((await db()`select display_name from pros where id = ${lead.pro}`)[0].display_name).toBe(shown);
  });
});

test("a client reviews a pro after a closed inquiry and it appears once approved", async ({ page, browser, isMobile }) => {
  test.skip(isMobile, "multi party desktop flow");
  test.setTimeout(150_000);
  const email = await signIn(page, "reviewer", "/");
  const { path } = await sampleListingPath(`l.listing_type = 'sale' and l.status = 'active' and l.city_region_id = (select id from regions where slug = 'san-francisco' and type = 'city') and ${COVERED_ZIP}`);
  await page.goto(path);
  await page.getByTestId("local-agent").getByRole("button", { name: /^Ask / }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Robin Reviewer");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Send message" }).click();
  const lead = await waitForAssignment({ email });

  // The pro closes the lead.
  const pro = await browser.newPage();
  await signInAs(pro, await proEmail(lead.pro!), "/pro/leads");
  await pro.locator(`[data-lead-id="${lead.id}"]`).getByTestId("lead-status").selectOption("closed");
  await expect.poll(async () => (await db()`select status from leads where id = ${lead.id}`)[0].status).toBe("closed");
  await pro.close();

  await page.goto("/account/inquiries");
  const item = page.getByTestId("inquiry").first();
  await item.getByRole("button", { name: "5 stars" }).click();
  await item.getByLabel("Your review (optional)").fill("Quick replies and great advice.");
  await item.getByRole("button", { name: "Submit review" }).click();
  await expect(item.getByRole("status")).toContainText("Thanks for your review");

  const admin = await browser.newPage();
  await signInAs(admin, "admin@example.com", "/admin/moderation");
  await admin.getByTestId("moderation-item").filter({ hasText: "5 star review" }).first().getByRole("button", { name: "Approve" }).click();
  await expect.poll(async () => (await db()`select status from pro_reviews where lead_id = ${lead.id}`)[0]?.status).toBe("approved");
  await admin.close();

  const [p] = await db()`select slug, review_count from pros where id = ${lead.pro}`;
  expect(p.review_count).toBeGreaterThan(0);
  await page.goto(`/agent/${p.slug}`);
  await expect(page.getByTestId("reviews")).toContainText("Quick replies and great advice.");
});

test.describe("admin and pros", () => {
  test("admin reassigns a lead and routing_log records it", async ({ page, isMobile }) => {
    test.skip(isMobile, "admin desktop flow");
    const [lead] = await db()`select id, assigned_pro_id as pro from leads where assigned_pro_id is not null order by created_at desc limit 1`;
    test.skip(!lead, "needs at least one assigned lead");
    await signInAs(page, "admin@example.com", "/admin/leads");
    const row = page.locator(`[data-lead-id="${lead.id}"]`).first();
    const form = row.getByTestId("reassign-form");
    const options = await form.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    const target = options.find((o) => o !== lead.pro)!;
    await form.getByRole("combobox").selectOption(target);
    await form.getByRole("button", { name: "Reassign" }).click();
    await expect(form.getByRole("status")).toContainText("Reassigned");
    const [after] = await db()`select assigned_pro_id as pro, routing_log -> -1 as last from leads where id = ${lead.id}`;
    expect(after.pro).toBe(target);
    expect(after.last).toMatchObject({ action: "admin_reassigned", pro_id: target });
  });

  test("admin sees feed health, lead stats and the moderation queue", async ({ page, isMobile }) => {
    test.skip(isMobile, "admin desktop flow");
    await signInAs(page, "admin@example.com", "/admin");
    await expect(page.getByTestId("feed-runs").locator("tbody tr")).not.toHaveCount(0);
    await expect(page.getByTestId("lead-stats")).toBeVisible();
    await page.getByRole("link", { name: "Moderation" }).click();
    await expect(page.getByRole("heading", { name: "Moderation queue" })).toBeVisible();
  });

  test("agent signup, admin approval, public profile and find an agent", async ({ page, browser, isMobile }) => {
    test.skip(isMobile, "desktop wizard flow");
    test.setTimeout(120_000);
    const agentName = `Jamie Newagent ${Math.random().toString(36).slice(2, 7)}`;
    await signIn(page, "newagent", "/pro/join");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Name clients will see").fill(agentName);
    await page.getByLabel("California DRE license number").fill("02123456");
    await page.getByLabel("Business phone").fill("213 555 0199");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Choose at least one ZIP code you serve.")).toBeVisible();
    await page.getByTestId("zip-picker").getByText("Sacramento", { exact: true }).click();
    await page.getByLabel("All ZIP codes in Sacramento").check();
    await page.getByLabel("Lowest home price ($)").fill("300000");
    await page.getByLabel("Highest home price ($)").fill("900000");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
    await expect(page.locator("dd").filter({ hasText: "95811" })).toBeVisible();
    await page.getByRole("button", { name: "Create my profile" }).click();
    await expect(page).toHaveURL(/\/pro\/profile/);
    await expect(page.getByTestId("pro-pending")).toBeVisible();

    const admin = await browser.newPage();
    await signInAs(admin, "admin@example.com", "/admin/moderation");
    const item = admin.getByTestId("moderation-item").filter({ hasText: agentName });
    await item.getByRole("button", { name: "Approve" }).click();
    await expect(admin.getByTestId("moderation-item").filter({ hasText: agentName })).toHaveCount(0);
    await admin.close();

    const [pro] = await db()`select slug, status, license_verified_at is not null as verified from pros where display_name = ${agentName} order by created_at desc limit 1`;
    expect(pro).toMatchObject({ status: "active", verified: true });
    const [prefs] = await db()`select price_min, price_max, (select count(*)::int from pro_zip_codes z join pros p2 on p2.id = z.pro_id where p2.slug = ${pro.slug}) as zips from pros where slug = ${pro.slug}`;
    expect(prefs).toMatchObject({ price_min: 300000, price_max: 900000 });
    expect(prefs.zips).toBeGreaterThan(5);
    await page.goto(`/agent/${pro.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(agentName);
    await expect(page.getByText("License verified")).toBeVisible();
    await expect(page.getByTestId("agent-zips")).toContainText("95811");
    await page.goto("/agents/sacramento");
    await expect(page.getByTestId("agent-list")).toContainText(agentName);
  });
});
