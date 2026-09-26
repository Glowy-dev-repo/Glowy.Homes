import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProProfileForm } from "@/components/pro/ProProfileForm";
import { auth } from "@/lib/auth";
import { allRegions } from "@/lib/search/regions";
import { proForEdit } from "@/server/data/pros";

export const metadata: Metadata = { title: "Pro profile", robots: { index: false }, alternates: { canonical: "/pro/profile" } };

export default async function ProProfilePage() {
  const session = await auth();
  const pro = await proForEdit(session!.user.id);
  if (!pro) redirect("/pro/join");
  const regions = await allRegions();
  const cityIds = new Map(regions.filter((r) => r.type === "city").map((r) => [r.slug, r.id]));
  const areas = regions.map((r) => ({ id: r.id, name: r.name, type: r.type, parentId: r.type === "neighborhood" ? (cityIds.get(r.parentSlug ?? "") ?? null) : null }));

  return (
    <div className="container-page py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">Your pro profile</h1>
        <nav aria-label="Pro" className="flex gap-4 text-body">
          <Link href="/pro/leads" className="font-medium text-accent hover:underline">Leads</Link>
          <Link href="/pro/listings" className="font-medium text-accent hover:underline">Listings</Link>
          {pro.status === "active" && <Link href={`/agent/${pro.slug}`} className="font-medium text-accent hover:underline">Public profile</Link>}
        </nav>
      </div>
      {pro.status === "pending" && (
        <p role="status" className="mb-6 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-body text-neutral-900" data-testid="pro-pending">
          We are verifying your licence. You will start receiving leads once it is approved, typically within one business day.
        </p>
      )}
      {pro.status === "suspended" && (
        <p role="status" className="mb-6 rounded-md border border-danger/40 bg-danger/5 px-4 py-3 text-body text-neutral-900">
          Your profile is not receiving leads. Contact support to find out why.
        </p>
      )}
      <ProProfileForm initial={pro} areas={areas} />
    </div>
  );
}
