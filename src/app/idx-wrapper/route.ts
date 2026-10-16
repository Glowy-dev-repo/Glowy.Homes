import { brand } from "@/config/brand";
import { broker } from "@/config/broker";
import { idxWrapperHtml } from "@/lib/idx/wrapper";

// IDX Broker fetches this page and wraps its hosted listing pages in it (Design, Website, Wrappers,
// dynamic wrapper URL). It holds only the public header and footer, so it is exempt from the preview password.
export const dynamic = "force-dynamic";

export function GET() {
  const html = idxWrapperHtml({
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? `https://${brand.domain}`,
    idxUrl: process.env.IDX_BASE_URL?.trim() || "https://glowyhomes.idxbroker.com",
    broker,
  });
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
      // The wrapper alone is an empty shell; only the wrapped IDX pages should be indexed.
      "x-robots-tag": "noindex",
    },
  });
}
