import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Admin",
  description: "Operations dashboard.",
  robots: { index: false },
};

export default async function AdminPage() {
  // Second check behind middleware (docs/02 section 8.5).
  const session = await auth();
  if (!session?.user.roles.includes("admin")) notFound();

  return (
    <div className="container-page py-10">
      <h1 className="text-h1">Admin</h1>
      <p className="mt-2 text-body text-neutral-600">Feed health, lead volume and moderation will appear here.</p>
    </div>
  );
}
