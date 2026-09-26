import type { Metadata } from "next";
import { LeadForm } from "@/components/lead/LeadForm";

export const metadata: Metadata = {
  title: "Get preapproved for a mortgage",
  description: "Send a preapproval request to a local mortgage professional. No obligation.",
  alternates: { canonical: "/mortgage/preapproval" },
};

/** docs/01 B4: preapproval request routed to a lender who covers the area. */
export default function PreapprovalPage() {
  return (
    <div className="container-page max-w-xl py-10">
      <h1 className="text-h1">Get preapproved</h1>
      <p className="mt-2 text-body text-neutral-700">A mortgage professional will reach out to help you get preapproved. There is no obligation, and approval is subject to the lender&apos;s review.</p>
      <div className="mt-8">
        <LeadForm leadType="preapproval" defaultMessage="I would like to get preapproved for a mortgage." submitLabel="Request preapproval" />
      </div>
    </div>
  );
}
