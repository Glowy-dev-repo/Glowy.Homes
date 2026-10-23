import Link from "next/link";
import { cn } from "@/lib/utils";

/** Page title and one plain sentence on what the page is for. */
export function AdminHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-h1">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-body text-neutral-600">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** White panel used for every section in admin. */
export function Panel({ title, description, children, className, testId }: { title?: string; description?: string; children: React.ReactNode; className?: string; testId?: string }) {
  return (
    <section className={cn("rounded-lg border border-neutral-200 bg-white p-5", className)} data-testid={testId}>
      {title && <h2 className="text-h3">{title}</h2>}
      {description && <p className="mt-1 text-small text-neutral-600">{description}</p>}
      <div className={title || description ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

/** A number with its label, optionally linking to where it can be acted on. */
export function Stat({ label, value, href, tone = "plain", testId }: { label: string; value: string | number; href?: string; tone?: "plain" | "attention"; testId?: string }) {
  const body = (
    <>
      <p className="text-small text-neutral-600">{label}</p>
      <p className={cn("tabular mt-1 text-h1", tone === "attention" && "text-accent")}>{value}</p>
    </>
  );
  const cls = cn("block rounded-lg border bg-white p-4", tone === "attention" ? "border-accent/40" : "border-neutral-200", href && "transition-colors hover:border-accent");
  return href ? (
    <Link href={href} className={cls} data-testid={testId}>{body}</Link>
  ) : (
    <div className={cls} data-testid={testId}>{body}</div>
  );
}

/** Tabs that are plain links, so each view has its own address. */
export function Tabs({ items }: { items: { href: string; label: string; active: boolean; count?: number }[] }) {
  return (
    <nav aria-label="Views" className="mb-5 flex gap-1 overflow-x-auto border-b border-neutral-200">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 font-medium",
            t.active ? "border-accent text-neutral-900" : "border-transparent text-neutral-600 hover:text-neutral-900",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="tabular rounded-pill bg-neutral-100 px-2 text-small text-neutral-700">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
