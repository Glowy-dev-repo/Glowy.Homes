# GlowHomes: Week 1 plan

Monday September 28 to Friday October 2, 2026.

The goal for the week: by Friday, GlowHomes runs live on the internet at glowy.homes with demo data, sign in emails work, and you know exactly what is needed to put real California listings on it.

Each day has a goal, the steps in order, and how you know the day is done. The list of everything you need is at the end.

## Day 1, Monday: learn the system

**Goal:** you can run the site on your computer and you know every part of it as a user.

1. Open Docker Desktop and wait until it says it is running.
2. In the project folder, run these one at a time:
   1. `npm run db:up` starts the database.
   2. `npm run dev` starts the site.
   3. In a second terminal, `npm run inngest:dev` starts the background jobs (lead routing, alerts).
3. Open http://localhost:3000.
4. Walk through the site as each type of user. Keep a notes file open and write down anything you want changed.

   | Role | Sign in as | Try this |
   |---|---|---|
   | Buyer | consumer01@example.com | Search Los Angeles, filter, save a home, save a search, request a tour |
   | Renter | consumer02@example.com | Search rentals, fill in the rental application, apply to two rentals |
   | Owner | consumer03@example.com | Home value page, claim a home, correct its facts |
   | Seller or landlord | any new email | List a home for sale, list a rental |
   | Agent | a pro account from the admin leads page | Open the lead inbox, change a lead status |
   | Admin | admin@example.com | Overview, leads, moderation (approve the listing you posted), funnel |

   Locally no real email is sent. After you ask for a sign in link, open the `.dev-mail` folder in the project and open the file named after that email; the link is inside.
5. Read `HANDOFF.md` once from top to bottom.
6. Decide on hosting: Render paid plan (always on) or Render free plan (sleeps when idle, free database deleted after 30 days).

**Done when:** you have used every role above, your notes file has your change list, and the hosting decision is made.

## Day 2, Tuesday: create the accounts

**Goal:** every service the live site needs has an account and its keys are saved safely.

1. Create a password manager entry called "GlowHomes keys". Every key goes there. Never paste keys into chat, email or the code.
2. Create or set up each account in this order (details in the list at the end):
   1. Render: add a payment method.
   2. Resend: the service that sends sign in and alert emails.
   3. Inngest Cloud: runs background jobs on the live site.
   4. Cloudflare R2: stores photos that owners and landlords upload.
   5. Sentry: tells you when the live site has an error.
   6. Optional today: MapTiler (branded map style), Google sign in, Anthropic (smarter search by description).
3. Set up a real inbox for support@glowy.homes (Squarespace email through Google Workspace, or another provider). Customers will write to it.

**Done when:** each account exists, each key is in the password manager, and support@glowy.homes receives a test email.

## Day 3, Wednesday: put the site live

**Goal:** the site works on a Render web address, on your phone and computer.

1. Tell Claude "push" so the latest code goes to GitHub.
2. In Render: New, then Blueprint, then pick the Glowy.Homes repository. Render creates the website and the database from the project's settings file.
3. When Render asks for secret values, paste the keys from Day 2.
4. Wait for the first deploy to show "Live".
5. Load the demo data: give Claude the database's External Database URL (from the database's Connect button in Render), and Claude loads the 50,000 demo listings.
6. In Render, open the website service, then Manual Deploy, then Deploy latest commit, so the pages rebuild with the data.
7. Test on your phone and computer: home page, search with the map, a listing, sign in, save a home.
8. Tell Claude the Render address so the settings can be updated if it is not glowy-homes.onrender.com.

**Done when:** you can sign in on the live Render address from your phone and the sign in email arrives in your real inbox.

## Day 4, Thursday: connect glowy.homes and email

**Goal:** people reach the site at glowy.homes, and emails come from @glowy.homes.

1. In Render, open the website service, then Settings, then Custom Domains, and add glowy.homes and www.glowy.homes. Render shows DNS records.
2. In Squarespace, open Domains, then glowy.homes, then DNS settings. Replace the Squarespace default records with the ones Render showed. Keep the email security records that are already there.
3. In Resend, add the domain glowy.homes. Resend shows more DNS records; add them in Squarespace too.
4. Wait for both to verify. It can take from a few minutes to a few hours.
5. Tell Claude when glowy.homes works, so the site's address setting can be switched to https://glowy.homes and redeployed.
6. Test again from your phone: https://glowy.homes, sign in, save a search, check that the email comes from @glowy.homes.
7. Ask Claude to rerun the speed and accessibility checks on the live site.

**Done when:** https://glowy.homes loads with the padlock, and sign in emails arrive from @glowy.homes.

## Day 5, Friday: plan the path to real listings

**Goal:** you know what it takes to show real California homes and to run the business side, and next week is planned.

1. **Real listings and photos.** Real homes and photos come only from a licensed MLS feed. Find out:
   1. Are you, or a partner, a licensed California real estate broker?
   2. If yes, ask the MLS (for example CRMLS in Southern California) about a data license for a website (IDX or VOW feed through the RESO Web API), the monthly cost, and the display rules.
   3. If no, list local brokerages to approach for a partnership.
2. **Legal.** Book a California real estate lawyer to review the Terms, the Privacy page, the fair housing wording and the rules for listings posted by owners and landlords.
3. **Logo.** Decide whether to keep the current GlowHomes mark or brief a designer for a final logo.
4. **First users.** Write a short list of 10 agents and 10 landlords in one city (Los Angeles is the biggest) you could invite to try the site.
5. **Payments.** Decide whether to charge for featured listings or agent subscriptions now or later. If now, open a Stripe account.
6. Review your Day 1 change list with Claude and pick what goes into next week.

**Done when:** you have answers or booked calls for the MLS feed and the lawyer, a first user list, and next week's plan.

## What you need

### Accounts and keys

| What | Why | Where | Cost to start | When |
|---|---|---|---|---|
| Render | Runs the website and the database | render.com | About $7 a month for the site plus about $6 a month for the database and storage (check Render's pricing page); a free plan exists with limits | Day 2 |
| Resend | Sends sign in, alert and lead emails | resend.com | Free tier to start | Day 2 |
| Inngest Cloud | Background jobs: lead routing, alerts, valuations | inngest.com | Free tier to start | Day 2 |
| Cloudflare R2 | Stores photos uploaded by owners and landlords | cloudflare.com | Free tier to start | Day 2 |
| Sentry | Error alerts from the live site | sentry.io | Free tier to start | Day 2 |
| Email inbox for support@glowy.homes | Customer questions | Squarespace email or Google Workspace | Monthly per mailbox | Day 2 |
| MapTiler (optional) | Branded map style instead of the free default | maptiler.com | Free tier to start | Any time |
| Google sign in (optional) | "Sign in with Google" button | Google Cloud console | Free | Any time |
| Anthropic API key (optional) | Smarter search by description and neighborhood summaries | console.anthropic.com | Pay per use | Any time |
| Stripe (later) | Featured listings, agent subscriptions | stripe.com | No monthly fee, a fee per payment | When you decide to charge |
| Mail vendor (later) | Mails home claim codes to the property address | Lob or PostGrid | Per letter | Before launch |

### Access you already have

1. Squarespace login for glowy.homes (DNS changes on Day 4).
2. GitHub account Glowy-dev-repo (the code).
3. Docker Desktop on this computer (the local database).

### People

1. **A licensed California real estate broker**, you or a partner, to sign the MLS data agreement.
2. **A California real estate lawyer** for the Terms, Privacy, fair housing and listing rules.
3. **A designer (optional)** for a final logo.
4. **First agents and landlords** willing to try the site.

### Decisions only you can make

1. Paid or free hosting.
2. Keep the current logo mark or commission a final logo.
3. Which city to launch first.
4. When to start charging, and for what.
5. Whether to pursue an MLS feed now or grow first with owner and landlord listings.

### What to ask Claude for this week

1. Day 3: "push", load the demo data, update the site address.
2. Day 4: switch the address to glowy.homes, rerun the live checks.
3. Day 5: turn your change list into next week's plan.
