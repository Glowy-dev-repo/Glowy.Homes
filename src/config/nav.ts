import { brand } from "./brand";

export type NavLink = { label: string; href: string };

const firstCity = brand.market.cities[0].slug;

// Header order from docs/04 section 4 (Home).
export const primaryNav: NavLink[] = [
  { label: "Buy", href: "/search?type=sale" },
  { label: "Rent", href: "/search?type=rent" },
  { label: "Sell", href: "/sell" },
  { label: "Home value", href: "/home-value" },
  { label: "Find an agent", href: `/agents/${firstCity}` },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "How estimates work", href: "/methodology" },
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
  {
    title: "Professionals",
    links: [
      { label: "For agents", href: "/pro" },
      { label: "For lenders", href: "/pro" },
      { label: "For landlords", href: "/landlord" },
    ],
  },
  {
    title: "Explore",
    links: [
      { label: "Homes for sale", href: "/search?type=sale" },
      { label: "Homes for rent", href: "/search?type=rent" },
      { label: "Mortgage calculator", href: "/mortgage" },
      { label: "List your home", href: "/sell" },
    ],
  },
];

export const accountNav: NavLink[] = [
  { label: "Saved homes", href: "/account" },
  { label: "Saved searches", href: "/account/searches" },
  { label: "Tours and inquiries", href: "/account/inquiries" },
  { label: "My homes", href: "/account/homes" },
  { label: "Settings", href: "/account/settings" },
];
