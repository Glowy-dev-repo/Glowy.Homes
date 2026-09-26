import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Landlord dashboard",
  description: "Manage your rental listings, inquiries and applications.",
  alternates: { canonical: "/landlord" },
  robots: { index: false },
};

export default function LandlordPage() {
  return (
    <div className="container-page py-10">
      <h1 className="text-h1">Landlord dashboard</h1>
      <p className="mt-2 text-body text-neutral-600">Your rental listings, inquiries and applications will appear here.</p>
    </div>
  );
}
