"use client";

export type AreaOption = { id: string; name: string; type: "city" | "neighborhood"; parentId: string | null };

/** Service area picker: whole cities or individual neighborhoods, grouped by city. */
export function AreaPicker({ areas, value, onChange, error }: { areas: AreaOption[]; value: string[]; onChange: (ids: string[]) => void; error?: string }) {
  const cities = areas.filter((a) => a.type === "city");
  const toggle = (id: string, on: boolean) => onChange(on ? [...new Set([...value, id])] : value.filter((v) => v !== id));
  return (
    <fieldset aria-describedby={error ? "areas-error" : undefined}>
      <legend className="mb-2 text-small font-medium text-neutral-800">Areas you serve (choose up to 12)</legend>
      {error && (
        <p id="areas-error" role="alert" className="mb-2 text-small text-danger">
          {error}
        </p>
      )}
      <div className="space-y-3">
        {cities.map((c) => {
          const hoods = areas.filter((a) => a.parentId === c.id);
          const cityOn = value.includes(c.id);
          return (
            <details key={c.id} className="rounded-md border border-neutral-200 px-3" open={hoods.some((h) => value.includes(h.id)) || undefined}>
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3">
                <label className="flex items-center gap-3 text-body font-medium" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={cityOn} onChange={(e) => toggle(c.id, e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
                  All of {c.name}
                </label>
                <span className="text-small text-neutral-600">or choose neighborhoods</span>
              </summary>
              <div className="grid gap-x-4 pb-3 sm:grid-cols-2">
                {hoods.map((h) => (
                  <label key={h.id} className="flex min-h-11 items-center gap-3 text-body text-neutral-800">
                    <input type="checkbox" checked={value.includes(h.id)} onChange={(e) => toggle(h.id, e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
                    {h.name}
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>
      <p className="mt-2 text-small text-neutral-600">{value.length} selected</p>
    </fieldset>
  );
}
