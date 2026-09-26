import Link from "next/link";

/**
 * Static SVG map preview for browse pages: region outline plus listing dots. Server rendered,
 * no JavaScript, links to the full map search.
 */
export function MiniMap({
  rings,
  points,
  href,
  label,
}: {
  rings: [number, number][][];
  points: { lat: number; lng: number }[];
  href: string;
  label: string;
}) {
  const all = rings.flat();
  if (!all.length) return null;
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // Equirectangular with latitude correction so shapes look right.
  const kx = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const w = 400;
  const scale = w / ((maxX - minX) * kx || 1);
  const h = Math.max(160, Math.min(320, (maxY - minY) * scale));
  const sx = (x: number) => ((x - minX) * kx * scale).toFixed(1);
  const sy = (y: number) => (((maxY - y) / (maxY - minY || 1)) * h).toFixed(1);

  return (
    <Link href={href} className="group block overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
      <svg viewBox={`-8 -8 ${w + 16} ${h + 16}`} role="img" aria-label={label} className="h-auto w-full">
        {rings.map((ring, i) => (
          <polygon
            key={i}
            points={ring.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ")}
            fill="#ffffff"
            stroke="#a1a1aa"
            strokeWidth="1.5"
          />
        ))}
        {points.map((p, i) => (
          <circle key={i} cx={sx(p.lng)} cy={sy(p.lat)} r="4" fill="var(--color-accent)" stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>
      <span className="block border-t border-neutral-200 bg-white px-4 py-3 text-body font-medium text-accent group-hover:underline">
        View all on the map
      </span>
    </Link>
  );
}
