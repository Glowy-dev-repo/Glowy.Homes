import { formatArea, formatDate, formatPrice } from "@/lib/format";
import type { ValuationComp } from "@/types/valuation";

/** docs/01 V4: comparable sales used, with distance, sold date and price. Top five by weight. */
export function CompsTable({ comps }: { comps: ValuationComp[] }) {
  const top = comps.slice(0, 5);
  if (!top.length) return <p className="text-body text-neutral-600">No comparable sales were used.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-body" data-testid="comps-table">
        <caption className="sr-only">Comparable sales used for this estimate</caption>
        <thead>
          <tr className="border-b border-neutral-200 text-small text-neutral-600">
            <th scope="col" className="py-2 pr-3 font-medium">Address</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Sold price</th>
            <th scope="col" className="py-2 pr-3 font-medium">Sold</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Distance</th>
            <th scope="col" className="py-2 font-medium">Size</th>
          </tr>
        </thead>
        <tbody>
          {top.map((c) => (
            <tr key={`${c.propertyId}-${c.soldAt}`} className="border-b border-neutral-100">
              <td className="py-2 pr-3">{c.address}</td>
              <td className="tabular py-2 pr-3 text-right">{formatPrice(c.soldPrice)}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{formatDate(c.soldAt)}</td>
              <td className="tabular py-2 pr-3 text-right">{(c.distanceM / 1000).toFixed(1)} km</td>
              <td className="py-2 text-neutral-700">
                {[c.beds !== null ? `${c.beds} bd` : null, c.baths !== null ? `${c.baths} ba` : null, formatArea(c.sqft)].filter(Boolean).join(" · ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
