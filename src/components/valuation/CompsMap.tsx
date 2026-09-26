/** Static map of the subject home and the comparable sales used (no JavaScript). */
export function CompsMap({ subject, comps }: { subject: { lat: number; lng: number }; comps: { lat: number; lng: number; label: string }[] }) {
  const pts = [subject, ...comps];
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const pad = 0.004;
  const [minX, maxX, minY, maxY] = [Math.min(...lngs) - pad, Math.max(...lngs) + pad, Math.min(...lats) - pad, Math.max(...lats) + pad];
  const kx = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const w = 400;
  const h = Math.max(180, Math.min(320, ((maxY - minY) / ((maxX - minX) * kx)) * w));
  const sx = (x: number) => (((x - minX) / (maxX - minX)) * w).toFixed(1);
  const sy = (y: number) => (((maxY - y) / (maxY - minY)) * h).toFixed(1);
  return (
    <figure className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={`Map of this home and ${comps.length} comparable sales`}>
        {comps.map((c, i) => (
          <g key={i}>
            <circle cx={sx(c.lng)} cy={sy(c.lat)} r="7" fill="#52525b" stroke="#fff" strokeWidth="2" />
            <text x={sx(c.lng)} y={Number(sy(c.lat)) + 4} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">
              {i + 1}
            </text>
          </g>
        ))}
        <circle cx={sx(subject.lng)} cy={sy(subject.lat)} r="9" fill="var(--color-accent)" stroke="#fff" strokeWidth="3" />
      </svg>
      <figcaption className="flex gap-4 border-t border-neutral-200 bg-white px-3 py-2 text-small text-neutral-700">
        <span className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full bg-accent" />This home</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full bg-neutral-600" />Comparable sales, numbered as in the table</span>
      </figcaption>
    </figure>
  );
}
