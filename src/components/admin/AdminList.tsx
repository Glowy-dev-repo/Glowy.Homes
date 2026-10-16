import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber } from "@/lib/format";

// Filter bar and page links for the admin lists. Plain GET forms: filters live in the URL, so a
// filtered list can be bookmarked or shared and works without JavaScript.

const selectClass =
  "h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-base text-neutral-900 hover:border-neutral-400 focus-visible:border-accent";

export type FilterField =
  | { kind: "text"; name: string; label: string; value?: string; placeholder?: string; inputMode?: "numeric" }
  | { kind: "select"; name: string; label: string; value?: string; options: { value: string; label: string }[] };

export function AdminFilters({ action, fields }: { action: string; fields: FilterField[] }) {
  return (
    <form action={action} method="get" role="search" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
      {fields.map((f) => (
        <div key={f.name} className="space-y-1">
          <Label htmlFor={`f-${f.name}`}>{f.label}</Label>
          {f.kind === "text" ? (
            <Input id={`f-${f.name}`} name={f.name} defaultValue={f.value ?? ""} placeholder={f.placeholder} inputMode={f.inputMode} />
          ) : (
            <select id={`f-${f.name}`} name={f.name} defaultValue={f.value ?? ""} className={selectClass}>
              <option value="">All</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="submit">Filter</Button>
        <Button asChild variant="secondary">
          <Link href={action}>Clear</Link>
        </Button>
      </div>
    </form>
  );
}

export function AdminPager({ base, params, page, total, pageSize }: { base: string; params: Record<string, string | undefined>; page: number; total: number; pageSize: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-small text-neutral-600">
      <p>
        {formatNumber(total)} {total === 1 ? "result" : "results"} · page {page} of {pages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="secondary"><Link href={href(page - 1)}>Previous</Link></Button>
        ) : (
          <Button variant="secondary" disabled>Previous</Button>
        )}
        {page < pages ? (
          <Button asChild variant="secondary"><Link href={href(page + 1)}>Next</Link></Button>
        ) : (
          <Button variant="secondary" disabled>Next</Button>
        )}
      </div>
    </nav>
  );
}
