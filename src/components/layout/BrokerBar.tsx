import { brand } from "@/config/brand";
import { broker, brokerConfigured } from "@/config/broker";

/**
 * The brokerage behind the site, on every page above the header (CSMAR Rules 12.16.3, 12.16.14 and
 * 12.19: an IDX site must clearly be the broker's, naming the firm and its state of licensure in a
 * readily visible font and color). Hidden until the broker details are set; the admin overview warns.
 */
export function BrokerBar() {
  if (!brokerConfigured) return null;
  return (
    <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-1.5 text-center text-small text-neutral-800" data-testid="broker-bar">
      {brand.name} is brokered by <strong className="font-semibold">{broker.brokerageName}</strong>, a {brand.market.region} licensed real estate broker, DRE #{broker.dreLicense}
      {broker.phone ? (
        <>
          {" · "}
          <a href={`tel:${broker.phone.replace(/[^\d+]/g, "")}`} className="underline underline-offset-2">
            {broker.phone}
          </a>
        </>
      ) : null}
    </div>
  );
}
