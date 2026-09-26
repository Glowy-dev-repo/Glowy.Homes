import type { Metadata } from "next";
import { Prose } from "@/components/layout/Prose";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Privacy", description: `How ${brand.name} collects, uses and protects your information.`, alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <Prose title="Privacy" updated="September 26, 2026">
      <p>This page explains what {brand.name} collects, why, and the choices you have.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: your email, and your name and phone number if you add them.</li>
        <li>What you save: homes, searches, alert settings and notes.</li>
        <li>Requests you send: tours, questions and rental applications, including what you type into them.</li>
        <li>Homes you claim and the facts you correct.</li>
        <li>How the site is used: pages viewed, searches and clicks, linked to a random visitor id stored in a cookie, and to your account when you are signed in.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To run the site: sign in, saved homes, alerts, estimates for homes you own.</li>
        <li>To send your request to the professional, owner or landlord you contacted, and only to them.</li>
        <li>To improve the site, using usage data in aggregate.</li>
      </ul>
      <p>We do not sell your personal information. We never ask for a social insurance number and never run credit checks.</p>
      <h2>Emails</h2>
      <p>You get search alerts only for searches you save, at the frequency you choose. Every alert has a link to stop it. Change or stop alerts any time in your account.</p>
      <h2>Cookies</h2>
      <p>We use a sign in cookie, and a first party cookie with a random visitor id for usage statistics. We do not use advertising cookies.</p>
      <h2>Keeping and deleting data</h2>
      <p>Usage events are deleted after 13 months. You can ask us to delete your account and the information linked to it by writing to <a href={`mailto:${brand.supportEmail}`} className="text-accent hover:underline">{brand.supportEmail}</a>.</p>
      <h2>Contact</h2>
      <p>Privacy questions or requests: <a href={`mailto:${brand.supportEmail}`} className="text-accent hover:underline">{brand.supportEmail}</a>.</p>
    </Prose>
  );
}
