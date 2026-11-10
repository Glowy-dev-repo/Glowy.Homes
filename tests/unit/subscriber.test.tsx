import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// CSMAR Rule 12.16.14: an IDX site names the brokerage and, when the feed is licensed to an agent,
// that subscriber. The settings are read when the module loads, so each case imports it fresh.
async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const { BrokerBar } = await import("@/components/layout/BrokerBar");
  const config = await import("@/config/broker");
  return { html: renderToStaticMarkup(<BrokerBar />), config };
}

const BROKER = { BROKERAGE_NAME: "Keller Williams World Class", BROKER_DRE_LICENSE: "01523573" };

describe("MLS subscriber on the site", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("names Patrick LaPointe and his DRE number next to the brokerage by default", async () => {
    const { html, config } = await load(BROKER);
    expect(config.subscriberLine).toBe("Patrick LaPointe, DRE #02440112");
    expect(html).toContain("Keller Williams World Class");
    expect(html).toContain("DRE #01523573");
    expect(html).toContain("Agent: Patrick LaPointe, DRE #02440112");
  });

  it("can be changed from the environment", async () => {
    const { html } = await load({ ...BROKER, SUBSCRIBER_NAME: "Sam Lee", SUBSCRIBER_DRE_LICENSE: "01111111" });
    expect(html).toContain("Agent: Sam Lee, DRE #01111111");
  });

  it("shows nothing until the brokerage itself is set", async () => {
    const { html } = await load({ BROKERAGE_NAME: "", BROKER_DRE_LICENSE: "" });
    expect(html).toBe("");
  });
});
