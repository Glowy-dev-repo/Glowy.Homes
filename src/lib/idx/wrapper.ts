import { brand } from "@/config/brand";
import type { broker as brokerConfig } from "@/config/broker";
import { FAIR_HOUSING_STATEMENT } from "@/components/layout/Footer";

// The page IDX Broker wraps around its hosted search, map and listing pages (its "dynamic wrapper"):
// our header, brokerage bar and footer, with IDX Broker's content placed between idxStart and idxStop.
// IDX Broker serves the result from its own domain, so every link and image here is absolute and the
// page needs no JavaScript or Next.js assets.

type Broker = typeof brokerConfig;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function idxWrapperHtml(opts: { appUrl: string; idxUrl: string; broker: Broker }): string {
  const app = opts.appUrl.replace(/\/+$/, "");
  const idx = opts.idxUrl.replace(/\/+$/, "");
  const b = opts.broker;
  const nav = [
    { label: "Homes", href: `${idx}/idx/map/mapsearch` },
    { label: "Search", href: `${idx}/idx/search/advanced` },
    { label: "Home worth", href: `${app}/home-value` },
    { label: "Local agents", href: `${app}/agents` },
  ];
  const links = nav.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join("");
  const phone = b.phone ? ` · <a href="tel:${esc(b.phone.replace(/[^\d+]/g, ""))}">${esc(b.phone)}</a>` : "";
  const brokerBar =
    b.brokerageName && b.dreLicense
      ? `<div class="gh-broker">${esc(brand.name)} is brokered by <strong>${esc(b.brokerageName)}</strong>, a ${esc(brand.market.region)} licensed real estate broker, DRE #${esc(b.dreLicense)}${phone}</div>`
      : "";
  const brokerLine =
    b.brokerageName && b.dreLicense
      ? `<p><strong>${esc(brand.name)} is brokered by ${esc(b.brokerageName)}</strong>, a ${esc(brand.market.region)} licensed real estate broker, DRE #${esc(b.dreLicense)}.${b.brokerName ? ` Broker of record: ${esc(b.brokerName)}.` : ""}${b.phone ? ` ${esc(b.phone)}.` : ""}${b.email ? ` ${esc(b.email)}.` : ""}</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="${esc(app)}/icon.png">
<style>
.gh-shell{font-family:Jost,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a}
.gh-shell a{color:inherit}
.gh-broker{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:6px 16px;text-align:center;font-size:14px;color:#1e293b}
.gh-broker a{text-decoration:underline;text-underline-offset:2px}
.gh-header{border-bottom:1px solid #e2e8f0;background:#fff}
.gh-bar{max-width:1280px;margin:0 auto;padding:0 16px;height:64px;display:flex;align-items:center;gap:24px}
.gh-logo img{height:32px;width:auto;display:block}
.gh-nav{display:flex;gap:20px;font-size:15px;font-weight:500}
.gh-nav a{text-decoration:none;padding:8px 0}
.gh-nav a:hover{color:${brand.color}}
.gh-cta{margin-left:auto;background:${brand.color};color:#fff!important;text-decoration:none;border-radius:8px;padding:10px 16px;font-size:15px;font-weight:600;white-space:nowrap}
.gh-cta:hover{background:${brand.colorHover}}
.gh-menu{display:none;margin-left:auto}
.gh-menu summary{cursor:pointer;list-style:none;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px}
.gh-menu summary::-webkit-details-marker{display:none}
.gh-menu nav{position:absolute;right:16px;left:16px;margin-top:8px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px;z-index:50;box-shadow:0 8px 24px rgba(15,23,42,.12)}
.gh-menu nav a{display:block;padding:12px;text-decoration:none;font-size:16px}
.gh-main{max-width:1280px;margin:0 auto;padding:16px}
.gh-footer{margin-top:48px;background:#0B1B3F;color:#dbeafe;font-size:14px;line-height:1.6}
.gh-footer .gh-inner{max-width:1280px;margin:0 auto;padding:32px 16px}
.gh-footer strong{color:#fff;font-weight:500}
.gh-footer a{color:#fff;text-decoration:underline;text-underline-offset:2px}
.gh-footer p{margin:0 0 12px}
@media (max-width:820px){.gh-nav,.gh-bar>.gh-cta{display:none}.gh-menu{display:block}}
</style>
</head>
<body style="margin:0">
<div class="gh-shell">
${brokerBar}
<header class="gh-header"><div class="gh-bar">
<a class="gh-logo" href="${esc(app)}/" aria-label="${esc(brand.name)} home"><img src="${esc(app)}/brand/logo-color.svg" alt="${esc(brand.name)}" width="125" height="32"></a>
<nav class="gh-nav" aria-label="Main">${links}</nav>
<a class="gh-cta" href="${esc(app)}/agents">Talk to an agent</a>
<details class="gh-menu"><summary>Menu</summary><nav aria-label="Menu">${links}<a href="${esc(app)}/agents">Talk to an agent</a></nav></details>
</div></header>
</div>
<main class="gh-main">
<div id="idxStart"></div><div id="idxStop"></div>
</main>
<div class="gh-shell">
<footer class="gh-footer"><div class="gh-inner">
${brokerLine}
<p><strong>Fair housing. </strong>${esc(FAIR_HOUSING_STATEMENT)}</p>
<p>&copy; ${new Date().getFullYear()} ${esc(brand.name)}. Questions? Email <a href="mailto:${esc(brand.supportEmail)}">${esc(brand.supportEmail)}</a>.</p>
</div></footer>
</div>
</body>
</html>`;
}
