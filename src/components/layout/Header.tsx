import Link from "next/link";
import { primaryNav } from "@/config/nav";
import { HeaderAccount } from "./HeaderAccount";
import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Logo />
          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {primaryNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center rounded-md px-3 text-body font-medium text-neutral-700 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="hidden lg:block">
          <HeaderAccount />
        </div>
        <MobileNav />
      </div>
    </header>
  );
}
