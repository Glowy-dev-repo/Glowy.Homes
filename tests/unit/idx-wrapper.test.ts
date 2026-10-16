import { describe, expect, it } from "vitest";
import { idxWrapperHtml } from "@/lib/idx/wrapper";

const broker = {
  brokerageName: "Keller Williams World Class",
  brokerName: "Jeff Curtis",
  dreLicense: "01523573",
  phone: "(805) 777-7777",
  email: null,
};

describe("IDX Broker wrapper", () => {
  const html = idxWrapperHtml({ appUrl: "https://glowyhomes.com/", idxUrl: "https://glowyhomes.idxbroker.com", broker });

  it("marks where IDX Broker places its content, once", () => {
    expect(html.match(/<div id="idxStart"><\/div>/g)).toHaveLength(1);
    expect(html.match(/<div id="idxStop"><\/div>/g)).toHaveLength(1);
    expect(html.indexOf("idxStart")).toBeLessThan(html.indexOf("idxStop"));
  });

  it("names the brokerage and license in the top bar and footer", () => {
    expect(html).toContain("is brokered by <strong>Keller Williams World Class</strong>");
    expect(html).toContain("DRE #01523573");
    expect(html).toContain("Broker of record: Jeff Curtis.");
    expect(html).toContain('href="tel:8057777777"');
  });

  it("uses absolute links and images only, since IDX Broker serves it from its own domain", () => {
    const urls = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(5);
    for (const u of urls) expect(u).toMatch(/^(https:\/\/|mailto:|tel:)/);
    expect(html).toContain('href="https://glowyhomes.idxbroker.com/idx/map/mapsearch"');
    expect(html).toContain('href="https://glowyhomes.com/agents"');
    expect(html).not.toContain("<script");
  });

  it("escapes configured values and hides the broker bar until it is configured", () => {
    const odd = idxWrapperHtml({
      appUrl: "https://glowyhomes.com",
      idxUrl: "https://glowyhomes.idxbroker.com",
      broker: { ...broker, brokerageName: 'A & B <"Realty">' },
    });
    expect(odd).toContain("A &amp; B &lt;&quot;Realty&quot;&gt;");
    const bare = idxWrapperHtml({
      appUrl: "https://glowyhomes.com",
      idxUrl: "https://glowyhomes.idxbroker.com",
      broker: { ...broker, brokerageName: null },
    });
    expect(bare).not.toContain("is brokered by");
    expect(bare).toContain("idxStart");
  });
});
