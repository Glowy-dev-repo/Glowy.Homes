import type { ProPublic } from "@/server/data/pros";

type AgentLd = Record<string, unknown> & { areaServed: unknown[]; worksFor?: unknown; aggregateRating?: unknown };

/** schema.org RealEstateAgent for a partner agent's public profile. Serialize with jsonLdHtml (lib/json-ld). */
export function agentJsonLd(pro: Pick<ProPublic, "displayName" | "brokerageName" | "phone" | "rating" | "reviewCount" | "zips"> & { licenseNumber?: string | null }, url: string): AgentLd {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: pro.displayName,
    url,
    ...(pro.phone ? { telephone: pro.phone } : {}),
    ...(pro.licenseNumber ? { identifier: { "@type": "PropertyValue", propertyID: "California DRE license", value: pro.licenseNumber } } : {}),
    ...(pro.brokerageName ? { worksFor: { "@type": "Organization", name: pro.brokerageName } } : {}),
    areaServed: pro.zips.map((z) => ({ "@type": "PostalAddress", postalCode: z.zip, ...(z.cityName ? { addressLocality: z.cityName } : {}), addressRegion: "CA", addressCountry: "US" })),
    ...(pro.rating && pro.reviewCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: pro.rating, reviewCount: pro.reviewCount } } : {}),
  };
}
