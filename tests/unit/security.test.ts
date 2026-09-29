import { describe, expect, it } from "vitest";
import { nameForEmail } from "@/lib/email/safe-name";
import { jsonLdHtml } from "@/lib/json-ld";
import { photosBelongTo } from "@/lib/listings/photo-ownership";
import { clientIp, createRateLimiter } from "@/server/api/rate-limit";

const user = "0b8f3c2e-1111-4a4a-9a9a-000000000001";
const other = "0b8f3c2e-1111-4a4a-9a9a-000000000002";

describe("listing JSON LD in a script tag", () => {
  it("cannot close the script tag, and reads back unchanged", () => {
    const description = 'Nice home</script><script>alert(1)</script> & more';
    const html = jsonLdHtml({ description });
    expect(html).not.toContain("</script>");
    expect(html).not.toContain("<");
    expect(JSON.parse(html).description).toBe(description);
  });
});

describe("listing photos belong to the person listing", () => {
  const key = (u: string) => `uploads/${u}/7c1d2e3f-2222-4b4b-8b8b-000000000001`;
  it("accepts the user's own uploads", () => {
    expect(photosBelongTo(user, [{ storageKey: key(user) }, { storageKey: `local/${key(user)}` }], "")).toBe(true);
    expect(photosBelongTo(user, [{ sourceUrl: `https://media.example/uploads/${user}/7c1d2e3f-2222.webp` }], "https://media.example")).toBe(true);
  });
  it("refuses someone else's upload and any other URL", () => {
    expect(photosBelongTo(user, [{ storageKey: key(other) }], "")).toBe(false);
    expect(photosBelongTo(user, [{ sourceUrl: "http://169.254.169.254/latest/meta-data" }], "https://media.example")).toBe(false);
    expect(photosBelongTo(user, [{ sourceUrl: `https://media.example/uploads/${other}/a.webp` }], "https://media.example")).toBe(false);
    expect(photosBelongTo(user, [{ sourceUrl: `https://media.example.evil.com/uploads/${user}/a.webp` }], "https://media.example")).toBe(false);
    // Without R2 there are no URL uploads at all.
    expect(photosBelongTo(user, [{ sourceUrl: `https://media.example/uploads/${user}/a.webp` }], "")).toBe(false);
  });
});

describe("names in emails sent to other people", () => {
  it("keeps real names and drops links, addresses and phone numbers", () => {
    expect(nameForEmail("María O'Neil")).toBe("María O'Neil");
    expect(nameForEmail("Verify at evil.co now")).toBe("Verify at now");
    expect(nameForEmail("Call 415 555 0199")).toBe("Call");
    expect(nameForEmail("https://x.io")).toBe("Someone");
    expect(nameForEmail("", "there")).toBe("there");
  });
});

describe("rate limit keys", () => {
  const req = (xff: string) => new Request("http://x", { headers: { "x-forwarded-for": xff } });
  it("uses the address the host's proxy appended, not what the client claimed", () => {
    expect(clientIp(req("6.6.6.6, 203.0.113.9"))).toBe("203.0.113.9");
    expect(clientIp(req("203.0.113.9"))).toBe("203.0.113.9");
  });
  it("does not reset everyone's limit when many new keys appear", () => {
    const take = createRateLimiter(1, () => 0, 1);
    expect(take("victim")).toBe(true);
    for (let i = 0; i < 12_000; i++) take(`spoof-${i}`);
    // The victim's bucket was evicted as least recently used, not all buckets cleared at once;
    // a recent key survives.
    expect(take("spoof-11999")).toBe(false);
  });
});
