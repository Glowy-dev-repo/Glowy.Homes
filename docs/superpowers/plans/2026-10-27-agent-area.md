# Partner Agent Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen by the user) to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give partner agents a complete, secure path on Glowy Homes: they find the program, apply with their DRE license, wait for approval, work the leads Glowy Homes assigns them in their own workspace, and report closings, while admin controls every step.

**Architecture:** Builds on what already exists (`pros` table, `/pro/join` wizard, `/pro/leads` inbox, `/agent/[slug]` profiles, moderation approval, `adminReassign`). The agent workspace moves into its own route group `src/app/(agent)` with its own shell, like `src/app/admin`. Agent status changes go through one module (`src/lib/pros/status.ts`) that writes an audit log and sends the emails. Lead follow up after an admin assignment runs as an Inngest function.

**Tech Stack:** Next.js 15 App Router, postgres.js (`sqlClient`), drizzle migrations, Zod 4, Auth.js v5, Inngest, sharp, Resend (`sendEmail`), Vitest, Playwright.

**Spec:** `CLAUDE.md` (rules 6 to 10, quality bar), `docs/01_PRODUCT_SPEC.md` (pro sections P1 to P8, AD4), and the Design section below, which records the business model agreed with Konner King: every lead goes to Glowy Homes first, admin chooses the partner agent, agents pay by subscription or referral commission, leads never go to the listing agent.

## Design

### How an agent reaches the area

1. **Found:** header link "For agents", footer "Become a partner agent", the `/agents` pages, and an **admin invite email** (Konner recruits agents directly).
2. **Learns:** `/pro` landing page explains the real flow (Glowy Homes reviews every inquiry and assigns it), requirements (active California DRE license), and links the partner agreement at `/pro/agreement`.
3. **Applies:** `/pro/join` (sign in by magic link first) then the wizard: details with DRE number, ZIP codes and preferences, review with the agreement checkbox.
4. **Waits:** lands on `/pro/dashboard` showing "Application received, license check, live". Admin gets an email. Lead data stays locked (API returns 403).
5. **Approved:** admin opens `/admin/agents/[id]`, checks the license with the DRE public lookup link, approves. Agent gets a "You are live" email; public profile appears.
6. **Works leads:** admin assigns a lead, agent gets an email, opens `/pro/leads`, contacts the client, moves status. No reply in the response window: reminder to the agent; still nothing after a second window: admin is emailed to reassign.
7. **Closes:** marking a lead Closed asks for sale price and closing date; admin is emailed (referral fee tracking).
8. **Suspended:** admin suspends with a reason; agent loses lead access at once, gets an email, public profile disappears, admin sees their open leads to reassign.

### Status lifecycle

| From | Action (admin) | To | Email to agent |
|---|---|---|---|
| pending | approve | active (sets `license_verified_at`) | approved |
| pending | reject | suspended | not approved, with reason |
| active | suspend | suspended | suspended, with reason |
| suspended | reactivate | active | approved |

Any other pair is refused. Every change appends `{at, from, to, action, reason, admin_user_id}` to `pros.status_log`.

### Out of scope (written to PROGRESS.md as open decisions)

- Billing and subscriptions: Stripe key is missing (hard blocker 3 in CLAUDE.md) and pricing is not decided. The landing page says plans are shared on approval.
- Automatic DRE verification: the DRE has no licensed API; admin checks by hand through the public lookup link. No scraping.
- Partner agreement wording: shipped as a draft marked for lawyer review.

## Global Constraints

- No dashes (hyphen, en dash, em dash) in any user facing copy, email copy, headings or docs prose (CLAUDE.md rule 10).
- Never guarantee timelines, approvals or outcomes in copy: use "typically", "subject to" (rule 9).
- Every feature: UI, API route with Zod validation, migration if needed, one unit test, one Playwright test (rule 6).
- No `any` types. Server components by default.
- Every write route calls `rateLimitWrite(req)` first; every pro route uses `requirePro()`, every admin route uses `requireAdmin()` (both check the database, not only the session).
- Lead reads stay scoped to `assigned_pro_id`; a wrong owner gets 404, never 403 (ids do not leak).
- Mobile first at 390px; touch targets at least 44px; brand values from `src/config/brand.ts`.
- New migration file: `src/db/migrations/0011_agent_area.sql` (via `npm run db:generate` then edit, `npm run db:migrate`).
- Commits: `agents: <short description>`, no Claude or Co-Authored-By lines (CLAUDE.local.md). Push with plain `git push`.
- Gate: stop the dev server, delete `.next`, run `npx tsx scripts/phase_gate.ts --phase 6`.

## Review Focus

1. **Same DRE license typed differently** ("01364089", "1364089", "DRE# 01364089"): must normalize to the same 8 digits and be refused as a second account with a clear message. Test in Task 2.
2. **Agent suspended while signed in with open leads:** the very next `/api/pro/leads` call returns 403, the public profile returns 404, admin's agent page lists the open leads. Test in Task 4 and Task 12.
3. **A non image renamed `.jpg`, or a 20 MB photo:** 400 with a plain message, nothing stored, old photo kept. Test in Task 8.
4. **Admin assigns a lead to a pending or suspended agent:** refused (existing `exists ... status = 'active'` check), lead stays waiting. Test in Task 9.
5. **Closing with price 0, a negative price, or a future date:** 400 with field errors, status unchanged. Test in Task 10.

---

### Task 1: Migration for the agent area

**Files:**
- Modify: `src/db/schema/agents.ts`, `src/db/schema/leads.ts`
- Create: `src/db/migrations/0011_agent_area.sql` (generated, then hand edited for the data fix and partial index)
- Test: `tests/unit/agent-migration.test.ts`

**Interfaces:**
- Produces columns: `pros.agreement_version text`, `pros.agreement_accepted_at timestamptz`, `pros.status_log jsonb not null default '[]'`, `leads.close_price integer`, `leads.close_date date`.
- Produces table `pro_invites (id uuid pk, email text not null, name text, invited_by uuid references users, created_at timestamptz default now(), accepted_pro_id uuid references pros)` with unique index on `lower(email)`.
- Produces index `pros_agent_license_key`: unique on `(license_region, license_number) where pro_type = 'agent' and status <> 'suspended' and license_number is not null`.

- [ ] **Step 1:** Write `tests/unit/agent-migration.test.ts`: reads `0011_agent_area.sql` and asserts it contains `pros_agent_license_key`, `status <> 'suspended'`, `pro_invites`, `close_price`, and that the duplicate fix `update pros set status = 'suspended'` appears **before** the `create unique index`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/agent-migration.test.ts`. Expected: FAIL (file missing).
- [ ] **Step 3:** Add the drizzle columns and `proInvites` table, run `npm run db:generate`, rename the output to `0011_agent_area.sql`, then add by hand before the index:
  1. normalize existing values: `update pros set license_number = lpad(regexp_replace(license_number, '\D', '', 'g'), 8, '0') where pro_type = 'agent' and license_number ~ '\d'`
  2. suspend newer duplicates (keep the oldest per license), appending a `status_log` entry with reason `duplicate license`.
  Local data has 32 active test agents sharing `02123456`; this step keeps one.
- [ ] **Step 4:** Run the unit test (PASS), then `npm run db:migrate`, then check: `select count(*) from pros where status <> 'suspended' and license_number = '02123456'` returns 1.
- [ ] **Step 5:** Commit `agents: migration for agreement, status log, invites, closing details, one license per agent`.

### Task 2: Signup validation: DRE number, agreement, duplicate license

**Files:**
- Create: `src/lib/pros/license.ts`
- Modify: `src/lib/pros/schema.ts`, `src/server/data/pros.ts` (`createPro`), `src/app/api/pro/signup/route.ts`, `src/components/pro/ProSignupWizard.tsx`
- Test: `tests/unit/pro-license.test.ts`

**Interfaces:**
- Produces `normalizeDreLicense(raw: string): string | null` (strips non digits, rejects empty or more than 8 digits, left pads to 8).
- Produces `PARTNER_AGREEMENT_VERSION = "2026-10-draft"` in `src/lib/pros/license.ts`.
- `ProSignup` gains `agreeToTerms: z.literal(true, "Please accept the partner agreement.")` for agents; `licenseNumber` transforms through `normalizeDreLicense` with message "Enter your 8 digit California DRE license number."
- `createPro` returns `{ status: "license_taken" }` on unique violation `pros_agent_license_key` (postgres code `23505`); the route answers `409 { code: "license_taken", message: "This DRE license already has a partner account. Contact support if this is you." }`.
- `createPro` sets `agreement_version`, `agreement_accepted_at = now()`, and marks `pro_invites.accepted_pro_id` where `lower(email)` matches the user's email.

- [ ] **Step 1:** Write tests: `normalizeDreLicense("01364089")`, `("1364089")`, `("DRE# 01364089")` all equal `"01364089"`; `("")` and `("123456789")` are null; `ProSignup.safeParse` of an agent without `agreeToTerms` fails on path `agreeToTerms`; a landlord without it passes.
- [ ] **Step 2:** Run `npx vitest run tests/unit/pro-license.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. In the wizard review step add a required checkbox "I have read and accept the partner agreement" linking `/pro/agreement` (new tab), shown for agents only, with the error under it. Show the 409 message inline on submit.
- [ ] **Step 4:** Run the unit test and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Update `tests/e2e/leads.spec.ts` "agent signup..." to use a unique license per run (`String(Date.now()).slice(-8)`) and tick the agreement. Add an e2e in `tests/e2e/agent-area.spec.ts`: a second account submitting the same license formatted as `"DRE# " + license` sees "already has a partner account".
- [ ] **Step 6:** Commit `agents: DRE number check, partner agreement acceptance, one account per license`.

### Task 3: Agent emails

**Files:**
- Create: `src/lib/email/templates/pros.ts`
- Test: `tests/unit/pro-emails.test.ts`

**Interfaces (each returns `{ subject: string; text: string; html: string; link: string }`, same shape as `templates/leads.ts`):**
- `proApplicationReceivedEmail({ appUrl, name })` links `/pro/dashboard`
- `adminNewAgentEmail({ appUrl, proId, name, license, zips: string[] })` links `/admin/agents/${proId}`
- `proApprovedEmail({ appUrl, name, slug })` links `/pro/dashboard`
- `proNotApprovedEmail({ appUrl, name, reason })`
- `proSuspendedEmail({ appUrl, name, reason })`
- `proInviteEmail({ appUrl, name: string | null, inviterName })` links `/pro`
- `proLeadReminderEmail({ appUrl, leadId, leadType, address })` links `/pro/leads?lead=${leadId}`
- `adminNoReplyEmail({ appUrl, leadId, agentName, minutes })` links `/admin/leads?lead=${leadId}`
- `adminLeadClosedEmail({ appUrl, leadId, agentName, address, closePrice, closeDate })` links `/admin/leads?lead=${leadId}`

- [ ] **Step 1:** Write one test that calls every template with sample values and asserts: `link` starts with `appUrl`; `html` escapes `<script>` passed in `name` and `reason`; no output contains `—`, `–` or ` - `; `subject` never contains "guarantee".
- [ ] **Step 2:** Run `npx vitest run tests/unit/pro-emails.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement using the escaping helper already used in `templates/leads.ts`. Copy rules: "typically within one business day", no promises of lead volume.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `agents: emails for applications, approval, suspension, invites, reminders and closings`.

### Task 4: Status lifecycle module and admin agent page

**Files:**
- Create: `src/lib/pros/status.ts`, `src/app/admin/agents/[id]/page.tsx`, `src/app/api/admin/agents/[id]/status/route.ts`, `src/components/admin/AgentStatusForm.tsx`, `src/server/data/admin-agent.ts`
- Modify: `src/server/data/admin.ts` (`decideModeration` calls `setProStatus` for `pro` items), `src/app/admin/agents/page.tsx` (name links to `/admin/agents/${id}`), `src/server/data/pros.ts` (`createPro` sends application and admin emails after commit)
- Test: `tests/unit/pro-status.test.ts`, e2e in `tests/e2e/agent-area.spec.ts`

**Interfaces:**
- `type ProStatusAction = "approve" | "reject" | "suspend" | "reactivate"`
- `nextProStatus(current: "pending" | "active" | "suspended", action: ProStatusAction): "active" | "suspended" | null` (pure; table in Design)
- `setProStatus(sql: Sql, proId: string, action: ProStatusAction, opts: { adminUserId: string; reason: string | null }): Promise<{ ok: true; status: string; openLeadIds: string[] } | { ok: false; code: "not_found" | "bad_transition" | "license_taken" }>`: updates in one statement guarded by the current status, appends to `status_log`, sets `license_verified_at` on approve, resolves any open `moderation_items` for the pro, sends the email, revalidates `/agent/[slug]` and `/agents/[city]` with `revalidateSitePage`.
- Route body: `z.object({ action: z.enum([...]), reason: z.string().trim().max(500).optional() })` with reason required for `reject` and `suspend`.
- `adminAgentDetail(id: string)` returns profile, user email, license, DRE lookup URL `https://www2.dre.ca.gov/PublicASP/pplinfo.asp?License_id=${license}`, agreement version and date, status log, ZIP codes, counts (30 days, open, closed), `openLeads: { id, consumerName, leadType, status, assignedAt }[]`.

- [ ] **Step 1:** Unit test the full transition table of `nextProStatus` (4 allowed, every other pair null) and the route schema (suspend without reason fails).
- [ ] **Step 2:** Run `npx vitest run tests/unit/pro-status.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the module, route (`requireAdmin`, `rateLimitWrite`, uuid check, 404 for unknown id) and page: header with status badge, "Check license on the DRE site" external link (`rel="noopener noreferrer"`), agreement line, ZIP chips, history list from `status_log`, open leads each linking `/admin/leads?lead=id`, and `AgentStatusForm` showing only the allowed actions with a reason field and a confirm step for reject and suspend.
- [ ] **Step 4:** Run unit tests. Expected: PASS.
- [ ] **Step 5:** e2e: admin opens a pending test agent's page, sees the DRE link with the license, approves; DB shows `active` and `status_log` has one entry; then suspends with a reason; the agent's session gets 403 from `/api/pro/leads` and `/agent/${slug}` returns 404.
- [ ] **Step 6:** Commit `agents: admin agent page with approve, reject, suspend and reactivate, audit log and emails`.

### Task 5: Admin invites agents

**Files:**
- Create: `src/app/api/admin/agents/invite/route.ts`, `src/components/admin/InviteAgentForm.tsx`
- Modify: `src/app/admin/agents/page.tsx` (form at top, recent invites list with Joined or Waiting)
- Test: `tests/unit/agent-invite.test.ts`, e2e in `tests/e2e/agent-area.spec.ts`

**Interfaces:**
- Body `z.object({ email: z.string().trim().toLowerCase().email().max(254), name: z.string().trim().max(80).optional() })`.
- Responses: `201 { invited: true }`; `409 { code: "already_partner" }` when a pro exists for that email; resending an existing invite updates `created_at` and resends (no duplicate rows).
- Invites carry no token and grant nothing: the agent still signs in by magic link and is still approved by admin.

- [ ] **Step 1:** Unit test the body schema (uppercase email is lowercased, bad email fails).
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement route (`requireAdmin`, `rateLimitWrite`) and form with loading, success ("Invite sent to ...") and error states.
- [ ] **Step 4:** e2e: admin invites `invite-${Date.now()}@example.com`; the dev mail file for that address contains a link to `/pro`; inviting `admin@example.com`'s existing agent email returns the "already a partner" message.
- [ ] **Step 5:** Commit `agents: admin can invite agents by email`.

### Task 6: Agent workspace shell

**Files:**
- Move (with `Move-Item`, Windows lock): `src/app/(site)/pro/leads`, `pro/profile`, `pro/listings` to `src/app/(agent)/pro/...`
- Create: `src/app/(agent)/layout.tsx`, `src/components/pro/AgentNav.tsx`
- Modify: the three moved pages (drop their ad hoc `<nav aria-label="Pro">` and status banners), `src/components/layout/HeaderAccount.tsx` ("My leads" becomes "Agent workspace", `/pro/dashboard`)
- Test: e2e in `tests/e2e/agent-area.spec.ts`

**Interfaces:**
- Layout (server): `auth()`; no session redirects `/signin?callbackUrl=/pro/dashboard`; no pro redirects `/pro/join`; landlords keep their existing redirect to `/landlord`. Renders a sidebar (desktop) and a top bar with menu (390px), `main#main`, skip link, and one status banner for `pending` (`data-testid="pro-pending"`, keep the existing text) or `suspended`.
- `AgentNav` items: Overview `/pro/dashboard`, Leads `/pro/leads` (with count of new leads without reply), Profile `/pro/profile`, Listings `/pro/listings`, plus "View my public profile" (active only), "View website" `/`, "Sign out" (`signOutAction`). `aria-label="Agent"`, `aria-current="page"` on the active item.
- `/pro` and `/pro/join` stay in `(site)`. `src/lib/auth-access.ts` rules are unchanged.

- [ ] **Step 1:** Write the e2e first: a signed in active agent at 390px opens `/pro/leads`, opens the menu, sees all nav items, `aria-current` on Leads; a signed in non agent visiting `/pro/leads` lands on `/pro`.
- [ ] **Step 2:** Run `npx playwright test tests/e2e/agent-area.spec.ts -g "workspace"`. Expected: FAIL.
- [ ] **Step 3:** Move the folders, delete `.next`, build the layout and nav from `docs/04_DESIGN_SYSTEM.md` using the admin shell (`src/app/admin/layout.tsx`) as the pattern but with the brand light theme.
- [ ] **Step 4:** Run the e2e and `npm run typecheck`. Expected: PASS, and existing `leads.spec.ts` pro inbox tests still pass.
- [ ] **Step 5:** Commit `agents: own workspace with menu, separate from the public site`.

### Task 7: Agent overview page

**Files:**
- Create: `src/app/(agent)/pro/dashboard/page.tsx`, `src/server/data/pro-dashboard.ts`
- Modify: `src/components/pro/ProSignupWizard.tsx` (success goes to `/pro/dashboard`), `src/app/(site)/pro/join/page.tsx` (existing agent redirects to `/pro/dashboard`)
- Test: `tests/unit/pro-dashboard.test.ts`, e2e

**Interfaces:**
- `profileChecklist(p: { photoUrl: string | null; bio: string | null; phone: string | null; zipCodes: string[]; brokerageName: string | null }): { key: "photo" | "bio" | "phone" | "zips" | "brokerage"; done: boolean; href: string; label: string }[]` (pure).
- `proDashboard(proId: string)` returns `{ waitingReply: InboxLead[] (status new, no first response, max 5), stats: inboxStats result, closedThisYear: number }`.
- Page sections: status steps for pending ("Application received", "License check, typically one business day", "Live"); for active: "Leads waiting for your reply" (testId `waiting-reply`), stats, profile checklist (testId `profile-checklist`).

- [ ] **Step 1:** Unit test `profileChecklist` (empty profile gives 5 items not done; full profile all done).
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement data and page (server component, metadata `robots: { index: false }`).
- [ ] **Step 4:** e2e: a new pending agent after signup lands on `/pro/dashboard` and sees "License check"; an active agent with an assigned new lead sees it under `waiting-reply` linking `/pro/leads?lead=id`.
- [ ] **Step 5:** Commit `agents: overview page with application status, leads waiting and profile checklist`.

### Task 8: Profile photo upload

**Files:**
- Create: `src/app/api/pro/photo/route.ts`, `src/lib/pros/photo.ts`, `src/components/pro/PhotoUpload.tsx`
- Modify: `src/components/pro/ProProfileForm.tsx`, `src/app/(site)/agent/[slug]/page.tsx`, `src/app/(site)/agents/[city]/page.tsx` (show photo with `next/image` and blur placeholder, initials fallback stays)
- Test: `tests/unit/pro-photo.test.ts`, e2e

**Interfaces:**
- `MAX_PHOTO_BYTES = 5 * 1024 * 1024`; accepted types `image/jpeg`, `image/png`, `image/webp`.
- `encodeProPhoto(input: Buffer): Promise<Buffer>`: `sharp(input).rotate().resize(400, 400, { fit: "cover" }).webp({ quality: 82 })` (sharp drops metadata, so GPS EXIF is removed); throws `PhotoError("not_image")` when sharp cannot decode.
- `POST /api/pro/photo` (multipart field `photo`, `requirePro({ allowInactive: true })`, `rateLimitWrite`): checks declared size and type, then decodes; stores with `putVariant(\`pros/${proId}/${crypto.randomUUID()}\`, 400, buf)`; sets `pros.photo_url` to the key; answers `{ photoUrl }`. `DELETE` clears it. 400 messages: "Choose a JPG, PNG or WebP photo." and "Photos can be up to 5 MB."

- [ ] **Step 1:** Unit test: a 10x10 PNG made with sharp encodes to a 400x400 WebP with no `exif` in `sharp(out).metadata()`; a text buffer throws `not_image`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement route, helper and component (preview, loading, error, remove).
- [ ] **Step 4:** e2e: agent uploads `tests/e2e/fixtures/agent.png`, the public profile shows an `img` with the agent's name as alt; uploading a `.jpg` that holds text shows "Choose a JPG, PNG or WebP photo." and the photo stays.
- [ ] **Step 5:** Commit `agents: profile photo upload, resized and cleaned of location data`.

### Task 9: Follow up after admin assigns a lead

**Files:**
- Create: `src/inngest/functions/lead-follow-up.ts`
- Modify: `src/lib/leads/route.ts` (`adminReassign` returns the pro id; add `followUpAssigned`), `src/app/api/admin/leads/[id]/reassign/route.ts` (sends `lead/assigned` after success), `src/app/api/inngest/route.ts` (register), `src/components/admin/LeadCard.tsx` (shows "Reminder sent" and "No reply" from the routing log)
- Test: `tests/unit/lead-follow-up.test.ts`, e2e

**Interfaces:**
- Event `lead/assigned` data `{ leadId: string; proId: string }`.
- `followUpAssigned(sql: Sql, leadId: string, proId: string, stage: "remind" | "escalate"): Promise<"responded" | "reminded" | "escalated">`: returns `responded` when the lead is no longer assigned to `proId`, has `first_response_at`, or status is not `new`; otherwise appends `reminder_sent` or `no_response` to `routing_log` and emails the agent (`proLeadReminderEmail`) or every admin (`adminNoReplyEmail`). Never reassigns.
- Function `lead-follow-up`: `step.sleep(responseWindowMs())`, `remind`; if not responded, sleep again, `escalate`. Runs in both assignment modes for admin assignments only.

- [ ] **Step 1:** Unit test with the fake sql pattern from `tests/unit/lead-assignment.test.ts` and mocked `@/lib/email`: responded lead returns `responded` and sends nothing; unanswered returns `reminded` and emails the agent once; `escalate` emails each admin.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** e2e (gate sets `LEAD_REASSIGN_SECONDS=45`): admin assigns a waiting lead to an active agent; within 120 s the routing log has `reminder_sent` and the agent's dev mail has the reminder; assigning to a suspended agent is refused and the lead stays waiting (Review Focus 4).
- [ ] **Step 5:** Commit `leads: reminder to the agent and alert to admin when an assigned lead gets no reply`.

### Task 10: Closing details

**Files:**
- Modify: `src/app/api/pro/leads/[id]/route.ts` (Patch schema), `src/server/data/pro-leads.ts` (`updateLeadByPro` stores close fields), `src/components/pro/LeadInbox.tsx` (Closed opens a small form), `src/components/admin/LeadCard.tsx` and `src/server/data/admin-dashboard.ts` (show sale price and date)
- Create: `src/lib/leads/closing.ts`
- Test: `tests/unit/lead-closing.test.ts`, e2e

**Interfaces:**
- `LeadPatch` (moved to `src/lib/leads/closing.ts` so it is testable): adds `closePrice: z.number().int().min(1000).max(100_000_000)` and `closeDate: z.iso.date()` refined to not be in the future; both required when `status === "closed"`, refused otherwise.
- `updateLeadByPro(proId, leadId, patch: { status?; note?; closePrice?; closeDate? })` writes `close_price`, `close_date` and includes them in the routing log entry; after a change to `closed` the route emails admins `adminLeadClosedEmail`.

- [ ] **Step 1:** Unit test: closed without price fails on `closePrice`; price 0, negative, and tomorrow's date fail; closed with `750000` and today passes; `contacted` with a price fails.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement. Form copy: "Sale price" and "Closing date", with "Glowy Homes uses this for your referral statement."
- [ ] **Step 4:** e2e: agent closes an assigned lead with a price; admin's lead card shows the price; an admin email file exists.
- [ ] **Step 5:** Commit `leads: agents report sale price and closing date when they close a lead`.

### Task 11: Public pages: landing, agreement, profile compliance

**Files:**
- Modify: `src/app/(site)/pro/page.tsx`, `src/app/(site)/agent/[slug]/page.tsx`, `src/components/lead/LeadDialog.tsx` (optional `note` prop shown above the form), `src/server/data/pros.ts` (`ProPublic` gains `licenseNumber`)
- Create: `src/app/(site)/pro/agreement/page.tsx`, `src/lib/seo/agent-jsonld.ts`
- Test: `tests/unit/agent-jsonld.test.ts`, e2e

**Interfaces:**
- `agentJsonLd(pro: ProPublic, url: string): Record<string, unknown>`: `@type: "RealEstateAgent"`, name, url, image, telephone, `areaServed` (ZIP list as `PostalAddress` items), `worksFor` brokerage. Rendered with `JSON.stringify(...).replace(/</g, "\\u003c")`.
- Agent profile shows "DRE #01234567" next to the brokerage (California requires the license number on a licensee's web page) and the contact dialog note: "Your message goes to the Glowy Homes team, who will connect you with {first name} or another partner agent who serves this area."
- `/pro` sections: hero, How it works (Apply, License check, Leads assigned by Glowy Homes), What you need (active California DRE license, a phone and email you answer), Plans ("Plans and referral terms are shared when your application is approved."), FAQ (four questions), CTA. Remove the old claims "Delivered right away" and "moves to the next agent". Metadata with title, description, canonical, Open Graph.
- `/pro/agreement`: version `PARTNER_AGREEMENT_VERSION`, banner "Draft, under legal review", sections: who we are (brokered by Keller Williams World Class, broker Jeff Curtis, office DRE #01523573, from `brand`/env, not hardcoded in the component), how leads are assigned, response expectations, referral fees paid broker to broker as agreed in writing, client data use, ending the partnership.

- [ ] **Step 1:** Unit test `agentJsonLd`: a name containing `</script>` never produces `</script` in the serialized string; `areaServed` length equals ZIP count.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement pages. Check copy with a grep for `—|–| - ` in the touched files.
- [ ] **Step 4:** e2e: `/pro` has the three steps and a link to `/pro/agreement`; an active agent's profile shows `DRE #` and one `script[type="application/ld+json"]` with `RealEstateAgent`.
- [ ] **Step 5:** Commit `agents: landing page for the real flow, partner agreement draft, DRE number and structured data on profiles`.

### Task 12: End to end journey, security checks, gate

**Files:**
- Create: `tests/e2e/agent-journey.spec.ts`
- Modify: `PROGRESS.md` (assumptions, open decisions: pricing, Stripe, agreement review), `docs/IDX_COMPLIANCE_CHECKLIST.md` only if the DRE display item is listed there

- [ ] **Step 1:** Write one desktop journey test: admin invites an email; that user signs in, opens `/pro`, joins with a unique license and the agreement; dashboard shows "License check"; `GET /api/pro/leads` is 403; admin approves on `/admin/agents/[id]`; approved email exists; dashboard shows live; admin assigns a lead; agent sees it in `waiting-reply`, marks Contacted, then Closed with a price; admin sees the price; a second active agent requesting `GET /api/pro/leads/{id}` gets 404; admin suspends; next `/api/pro/leads` call is 403 and `/agent/{slug}` is 404; admin agent page lists the open leads.
- [ ] **Step 2:** Run `npx playwright test tests/e2e/agent-journey.spec.ts`. Expected: PASS (all earlier tasks done).
- [ ] **Step 3:** Run `npm run lint && npm run typecheck && npm run test`. Expected: all pass.
- [ ] **Step 4:** Stop the dev server, delete `.next`, run `npx tsx scripts/phase_gate.ts --phase 6`. Expected: PASS (the map drag timing test may need its usual retry).
- [ ] **Step 5:** Update `PROGRESS.md`, commit `agents: end to end journey test and progress notes`, `git push`.
