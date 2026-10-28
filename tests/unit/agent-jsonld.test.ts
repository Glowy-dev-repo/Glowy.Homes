import { describe, expect, it } from "vitest";
import { jsonLdHtml as jsonLdScript } from "@/lib/json-ld";
import { agentJsonLd } from "@/lib/seo/agent-jsonld";

const pro = {
  id: "p1",
  slug: "dana-reyes-abc12",
  proType: "agent",
  displayName: "Dana </script><script>alert(1)</script> Reyes",
  brokerageName: "Keller Williams World Class",
  licenseNumber: "01364089",
  phone: "8055550100",
  bio: null,
  photoUrl: null,
  languages: ["en"],
  yearsExperience: 10,
  rating: 4.8,
  reviewCount: 12,
  licenseVerified: true,
  zips: [
    { zip: "93021", cityName: "Moorpark", citySlug: "moorpark" },
    { zip: "91320", cityName: "Newbury Park", citySlug: "newbury-park" },
  ],
};

describe("agentJsonLd", () => {
  it("describes the agent as a RealEstateAgent serving their ZIP codes", () => {
    const ld = agentJsonLd(pro, "https://glowyhomes.com/agent/dana-reyes-abc12");
    expect(ld).toMatchObject({ "@context": "https://schema.org", "@type": "RealEstateAgent", url: "https://glowyhomes.com/agent/dana-reyes-abc12" });
    expect(ld.areaServed).toHaveLength(2);
    expect(ld.worksFor).toEqual({ "@type": "Organization", name: "Keller Williams World Class" });
    expect(ld.aggregateRating).toMatchObject({ ratingValue: 4.8, reviewCount: 12 });
  });

  it("cannot be broken out of its script tag by a name", () => {
    const text = jsonLdScript(agentJsonLd(pro, "https://glowyhomes.com/agent/x"));
    expect(text).not.toContain("</script");
    expect(JSON.parse(text).name).toBe(pro.displayName);
  });

  it("leaves out ratings an agent does not have", () => {
    expect(agentJsonLd({ ...pro, rating: null, reviewCount: 0 }, "https://x").aggregateRating).toBeUndefined();
  });
});
