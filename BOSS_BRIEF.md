# GlowHomes: first week plan and what I need

Prepared September 28, 2026.

## What we are building

GlowHomes is a home search website for California. People will be able to search homes for sale and for rent on a map, see an estimated value for any home, save homes and get alerts, and contact local agents, owners and landlords. Agents receive those requests in their own inbox. We start with Los Angeles, San Diego, San Jose, San Francisco and Sacramento.

## Where the listings come from

This is the most important item to settle early.

1. **We cannot copy listings from Zillow, Realtor.com, Redfin or any other site.** It breaks their terms and copyright law, and it is the fastest way to get the business sued.
2. **Real listings and their photos come from the MLS.** The MLS (Multiple Listing Service) is the database local agents list homes in. California has several, for example:
   1. CRMLS, the largest, covering most of Southern California.
   2. MLSListings for Silicon Valley and San Jose.
   3. MetroList for the Sacramento region.
   4. SFAR MLS for San Francisco.

   A broker can confirm which ones cover our five cities.
3. **To pull MLS data we need:**
   1. A licensed California real estate broker who is a member of the MLS, either inside the company or as a partner brokerage.
   2. A signed data license for a website. It is usually called an IDX feed (listings shown to the public) or a VOW feed (more detail for signed in users).
   3. Technical access, usually through the MLS's RESO Web API or a data vendor the MLS works with (for example Bridge Interactive, Trestle or Spark).
   4. Fees, typically a setup fee plus a monthly fee, which vary by MLS and vendor.
   5. Following the MLS display rules: showing the listing brokerage's name, required disclaimers, and keeping data fresh.
4. **Until the feed is approved,** we build and test with realistic sample data, clearly marked as sample data. When the feed is switched on, real listings and photos replace it. Owners and landlords can also post their own homes with their own photos directly on GlowHomes, which does not need the MLS.

## This week

| Day | Focus |
|---|---|
| Monday | Learn the product requirements and agree priorities with you |
| Tuesday | Open the service accounts the website needs (hosting, email sending, storage, monitoring) |
| Wednesday | Set up a private preview version of the site online for testing |
| Thursday | Connect the glowy.homes domain and our email |
| Friday | Plan the MLS data application and the legal review, and agree next week's plan with you |

## What I need from you

### Data (most urgent)

1. **Who is our licensed California broker?** If we do not have one, approval to approach a partner brokerage.
2. **Approval to apply for an MLS data license,** starting with the MLS that covers our first launch city.
3. **A budget for MLS setup and monthly data fees.** I will bring exact quotes once the MLS responds.

### Budget

1. **Monthly running costs to start:** website and database hosting of roughly $15 to $50 a month at launch size. Email sending, background jobs, photo storage and error monitoring all have free tiers to start and grow with use.
2. **A company card or billing contact** for these services.
3. **A legal review:** a few hours of a California real estate lawyer's time.

### Access

1. **The Squarespace login** (or someone who can edit DNS) for glowy.homes, to point the domain at the site and set up email sending.
2. **A support mailbox,** support@glowy.homes, and who will answer it.
3. **Confirmation that I can create the service accounts** in the company's name.

### Brand

1. **The final logo files for GlowHomes.** The logo folder I received contains a different brand's logo ("TidyUp"). Until we have the right files I will use a simple placeholder mark.

### Legal and policy

1. **Approval to hire a lawyer to review:**
   1. The Terms of Use.
   2. The Privacy Policy, including the California privacy rules (CCPA and CPRA).
   3. The fair housing wording and the rules for owner and landlord listings.
2. **Who owns the policies internally,** for example who approves or removes listings that break the rules.

### Decisions

1. **Launch city first:** my suggestion is Los Angeles, the largest market.
2. **When we start charging, and for what:** for example featured listings, or subscriptions for agents.
3. **First partners:** agents and landlords you know who could try the site early.

## Questions for today

1. Do we have a licensed broker, or should I look for a partner brokerage?
2. What monthly budget can I work within for the first three months?
3. Who can give me DNS access for glowy.homes?
4. Can you send the correct GlowHomes logo files?
5. Which city do you want to launch first?
