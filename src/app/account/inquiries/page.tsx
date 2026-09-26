import type { Metadata } from "next";
import Link from "next/link";
import { InquiryItem } from "@/components/account/InquiryItem";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { consumerLeads } from "@/server/data/pro-leads";

export const metadata: Metadata = { title: "Tours and inquiries", robots: { index: false }, alternates: { canonical: "/account/inquiries" } };

export default async function InquiriesPage() {
  const session = await auth();
  const inquiries = await consumerLeads(session!.user.id);
  return (
    <div>
      <h1 className="mb-6 text-h1">Tours and inquiries</h1>
      {inquiries.length ? (
        <ul className="space-y-4">
          {inquiries.map((i) => (
            <InquiryItem key={i.id} inquiry={i} />
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-6 py-12 text-center">
          <h2 className="text-h3">No tours or inquiries yet</h2>
          <p className="mt-1 text-body text-neutral-600">When you request a tour or contact an agent, it will show here.</p>
          <Button asChild className="mt-5">
            <Link href="/search">Find a home</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
