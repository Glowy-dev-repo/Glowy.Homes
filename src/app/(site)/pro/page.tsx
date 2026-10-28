import { BadgeCheck, ClipboardList, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Become a partner agent",
  description: `Join ${brand.name} as a partner agent: we review every inquiry from people searching in ${brand.market.region} and assign it to a partner agent who serves the home's ZIP code.`,
  alternates: { canonical: "/pro" },
  openGraph: { title: `Become a ${brand.name} partner agent`, url: "/pro" },
};

const STEPS = [
  { icon: ClipboardList, title: "Apply", body: "Tell us about you, your California DRE license and the ZIP codes you serve. It takes a few minutes." },
  { icon: BadgeCheck, title: "License check", body: "We check your license with the California DRE before you receive anything. This typically takes one business day." },
  { icon: Inbox, title: "Leads assigned by our team", body: `${brand.name} reviews every inquiry and assigns it to a partner agent who serves the home's ZIP code. You are emailed the moment one is yours.` },
];

const FAQ = [
  {
    q: "Where do the leads come from?",
    a: `From people searching for homes, asking about a home, requesting a tour or asking for a home value on ${brand.name}. Inquiries never go to the listing agent; our team assigns each one to a partner agent.`,
  },
  {
    q: "How are leads assigned?",
    a: "Our team looks at each inquiry and chooses a partner agent who serves the home's ZIP code, works in its price range and replies quickly. Volume depends on the area and season and is not promised.",
  },
  {
    q: "What does it cost?",
    a: "Plans and referral terms are shared when your application is approved. Nothing is charged to apply.",
  },
  {
    q: "What is expected of me?",
    a: "Reply to every lead quickly, keep its status up to date in your workspace, and report the sale price and closing date when a lead closes. Details are in the partner agreement.",
  },
];

export default function ProLandingPage() {
  return (
    <div className="container-page py-14 md:py-20">
      <h1 className="max-w-2xl text-h1 md:text-display">Become a {brand.name} partner agent</h1>
      <p className="mt-4 max-w-xl text-body text-neutral-600">
        People searching for homes in {brand.market.region} ask us about homes every day. Our team reviews each inquiry and connects it with a local partner agent who serves that ZIP code.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/pro/join">Apply now</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/pro/agreement">Read the partner agreement</Link>
        </Button>
      </div>

      <section aria-labelledby="how-h" className="mt-14">
        <h2 id="how-h" className="text-h2">How it works</h2>
        <ol className="mt-5 grid gap-5 md:grid-cols-3" data-testid="pro-steps">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-lg border border-neutral-200 bg-white p-6 shadow-card">
              <span className="grid size-11 place-items-center rounded-full bg-accent/10 text-accent">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-h3 font-semibold">
                <span className="sr-only">Step {i + 1}: </span>
                {title}
              </h3>
              <p className="mt-1 text-body text-neutral-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="need-h" className="mt-14 max-w-2xl">
        <h2 id="need-h" className="text-h2">What you need</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-body text-neutral-700">
          <li>An active California DRE real estate license.</li>
          <li>A phone number and email address you answer during the day.</li>
          <li>The ZIP codes you serve, and the price range and home types you work with.</li>
        </ul>
      </section>

      <section aria-labelledby="faq-h" className="mt-14 max-w-2xl">
        <h2 id="faq-h" className="text-h2">Questions</h2>
        <dl className="mt-4 space-y-5">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="text-h3">{f.q}</dt>
              <dd className="mt-1 text-body text-neutral-700">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-14 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
        <p className="text-h3">Ready to apply?</p>
        <p className="mt-1 text-body text-neutral-600">Questions first? Email {brand.supportEmail}.</p>
        <Button asChild className="mt-4">
          <Link href="/pro/join">Apply now</Link>
        </Button>
      </div>
    </div>
  );
}
