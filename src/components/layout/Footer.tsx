import Link from "next/link";
import { brand } from "@/config/brand";
import { footerNav } from "@/config/nav";
import { Logo } from "./Logo";

export const FAIR_HOUSING_STATEMENT =
  "We are committed to fair housing. We do not allow listings, advertising or search tools that discriminate on the basis of race, colour, ancestry, place of origin, religion, sex, sexual orientation, gender identity, age, marital or family status, disability or receipt of public assistance.";

export function Footer() {
  return (
    <footer className="mt-16 bg-navy text-blue-100">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Logo tone="light" />
          <p className="max-w-xs font-display text-[20px] text-white">{brand.tagline}</p>
        </div>
        {footerNav.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="text-label uppercase tracking-[0.14em] text-blue-200">{group.title}</h2>
            <ul className="mt-3 space-y-1">
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center text-small text-blue-100 transition-colors hover:text-white md:min-h-8"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="container-page border-t border-white/10 py-6">
        <nav aria-label="Cities">
          <h2 className="text-label uppercase tracking-[0.14em] text-blue-200">
            {brand.market.region} cities
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-4">
            {brand.market.cities.map((city) => (
              <li key={city.slug}>
                <Link
                  href={`/homes/${city.slug}`}
                  className="inline-flex min-h-11 items-center text-small text-blue-100 transition-colors hover:text-white"
                >
                  {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="container-page space-y-3 border-t border-white/10 py-6 text-small text-blue-200">
        <p>
          <strong className="font-medium text-white">Fair housing. </strong>
          {FAIR_HOUSING_STATEMENT}
        </p>
        <p>
          Estimates on this site are automated and are not appraisals. Listing information is provided for
          informational purposes and is subject to change.
        </p>
        <p>
          © {new Date().getFullYear()} {brand.name}. Questions? Email{" "}
          <a href={`mailto:${brand.supportEmail}`} className="text-white underline underline-offset-2 hover:text-white">
            {brand.supportEmail}
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
