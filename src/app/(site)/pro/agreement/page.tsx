import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { broker } from "@/config/broker";
import { PARTNER_AGREEMENT_VERSION } from "@/lib/pros/license";

export const metadata: Metadata = {
  title: "Partner agent agreement",
  description: `The terms partner agents accept when they join ${brand.name}.`,
  alternates: { canonical: "/pro/agreement" },
};

/** Shown to every agent at signup; the version they accept is saved with their account (pros.agreement_version). */
export default function PartnerAgreementPage() {
  const brokerage = broker.brokerageName ?? "our brokerage";
  const brokerLine = [broker.brokerName ? `broker of record ${broker.brokerName}` : null, broker.dreLicense ? `DRE #${broker.dreLicense}` : null].filter(Boolean).join(", ");
  const sections: { h: string; p: string[] }[] = [
    {
      h: "Who we are",
      p: [`${brand.name} is brokered by ${brokerage}${brokerLine ? `, ${brokerLine}` : ""}. Partner agents are independent licensees of their own brokerages.`],
    },
    {
      h: "How leads are assigned",
      p: [
        `People who ask about a home or request a tour on ${brand.name} agree to be contacted by a licensed professional. Our team reviews each inquiry and assigns it to a partner agent who serves the home's ZIP code.`,
        "We do not promise any number of leads. Assignment depends on the area, the inquiry and each agent's record of replying and following up.",
      ],
    },
    {
      h: "Replying and keeping status up to date",
      p: [
        "Reply to each assigned lead as soon as you can, typically within a few hours during the day. If a lead has no reply we remind you, and we may assign it to another partner agent.",
        "Keep each lead's status current in your workspace. When a lead closes, report the sale price and closing date.",
      ],
    },
    {
      h: "Referral fees",
      p: ["Any referral fee is paid broker to broker, from your brokerage to ours, on the terms we agree in writing when your application is approved. Nothing here sets a fee by itself."],
    },
    {
      h: "Client information",
      p: [
        "Use the contact details and home activity we share only to help that client with their real estate needs. Do not sell or share them, or add clients to marketing lists without their consent.",
        "Follow fair housing laws and the rules of your MLS and brokerage in every conversation.",
      ],
    },
    {
      h: "Your profile",
      p: ["Your public profile shows your name, photo, brokerage, DRE license number, ZIP codes and reviews. Keep it accurate. Reviews come only from clients of closed leads and are checked before they appear."],
    },
    {
      h: "Ending the partnership",
      p: [`You can pause leads at any time in your profile, or leave by emailing ${brand.supportEmail}. We may pause or end a partnership, for example after complaints or leads left without replies; you will be told why.`],
    },
  ];

  return (
    <div className="container-page max-w-3xl py-14">
      <p role="note" className="mb-6 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-body text-neutral-900" data-testid="agreement-draft">
        Draft, under legal review. The final wording may change before launch.
      </p>
      <h1 className="text-h1">Partner agent agreement</h1>
      <p className="mt-2 text-small text-neutral-600">Version {PARTNER_AGREEMENT_VERSION}</p>
      <div className="mt-8 space-y-8">
        {sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-h2">{s.h}</h2>
            {s.p.map((t) => (
              <p key={t} className="mt-2 text-body text-neutral-700">{t}</p>
            ))}
          </section>
        ))}
      </div>
      <p className="mt-10 text-body">
        <Link href="/pro/join" className="font-medium text-accent hover:underline">Apply to become a partner agent</Link>
      </p>
    </div>
  );
}
