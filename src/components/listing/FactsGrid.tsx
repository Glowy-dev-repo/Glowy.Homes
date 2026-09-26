export type Fact = { label: string; value: string };
export type FactGroup = { title: string; facts: Fact[] };

/**
 * docs/04 FactsGrid: two columns on desktop, one on mobile. Groups after the first eight facts
 * collapse into expandable sections (native details, no JavaScript).
 */
export function FactsGrid({ groups }: { groups: FactGroup[] }) {
  const visible = groups.filter((g) => g.facts.length);
  let shown = 0;
  return (
    <div className="space-y-4">
      {visible.map((g) => {
        const open = shown < 8;
        shown += g.facts.length;
        const list = (
          <dl className="grid gap-x-8 sm:grid-cols-2">
            {g.facts.map((f) => (
              <div key={f.label} className="flex justify-between gap-4 border-b border-neutral-100 py-2 text-body">
                <dt className="text-neutral-600">{f.label}</dt>
                <dd className="text-right text-neutral-900">{f.value}</dd>
              </div>
            ))}
          </dl>
        );
        return open ? (
          <div key={g.title}>
            <h3 className="mb-1 text-h3">{g.title}</h3>
            {list}
          </div>
        ) : (
          <details key={g.title} className="group rounded-md border border-neutral-200 px-4">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between text-h3 marker:content-none">
              {g.title}
              <span aria-hidden className="text-neutral-500 transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="pb-3">{list}</div>
          </details>
        );
      })}
    </div>
  );
}
