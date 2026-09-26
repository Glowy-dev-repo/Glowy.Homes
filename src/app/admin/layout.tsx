import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Second check behind middleware (docs/02 section 8.5).
  const session = await auth();
  if (!session?.user.roles.includes("admin")) notFound();
  return (
    <div className="container-page py-8">
      <nav aria-label="Admin" className="mb-6 flex flex-wrap gap-2 border-b border-neutral-200 pb-3">
        {[
          ["/admin", "Overview"],
          ["/admin/leads", "Leads"],
          ["/admin/moderation", "Moderation"],
          ["/admin/funnel", "Funnel"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-md px-3 font-medium text-neutral-800 hover:bg-neutral-100">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
