import type { Metadata } from "next";
import { Prose } from "@/components/layout/Prose";
import { brand } from "@/config/brand";
import { ESTIMATE_DISCLAIMER } from "@/types/valuation";

export const metadata: Metadata = { title: "Terms of use", description: `The terms for using ${brand.name}.`, alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <Prose title="Terms of use" updated="September 26, 2026">
      <p>By using {brand.name} you agree to these terms. If you do not agree, please do not use the site.</p>
      <h2>Listings and information</h2>
      <p>Listing information comes from listing brokerages, owners and landlords. It is provided as is, is deemed reliable but not guaranteed, and may change or be withdrawn at any time. Check important details with the listing agent, owner or landlord.</p>
      <h2>Estimates</h2>
      <p>{ESTIMATE_DISCLAIMER} Estimates show a range and a confidence level. Do not rely on an estimate alone when you buy, sell, rent, borrow or insure a home.</p>
      <h2>Professionals</h2>
      <p>Agents, lenders and landlords on {brand.name} are independent. We do not employ them and do not guarantee their services, availability, response times, approvals or outcomes.</p>
      <h2>Your account and content</h2>
      <ul>
        <li>Keep your account secure and your information accurate.</li>
        <li>Anything you post, such as a listing, a review or a message, must be truthful, must be yours to share, and must not discriminate on protected grounds.</li>
        <li>We may review, edit or remove content that breaks these terms, and suspend accounts that misuse the site.</li>
      </ul>
      <h2>Acceptable use</h2>
      <p>Do not copy or scrape the site, interfere with how it works, or use it to send unsolicited messages.</p>
      <h2>Liability</h2>
      <p>To the extent the law allows, {brand.name} is not liable for indirect or consequential losses from using the site or relying on its information.</p>
      <h2>Contact</h2>
      <p>Questions about these terms: <a href={`mailto:${brand.supportEmail}`} className="text-accent hover:underline">{brand.supportEmail}</a>.</p>
    </Prose>
  );
}
