export type NavLink = { label: string; href: string };

// Our own words and order: homes first, then the local partner agents the site is built around.
export const primaryNav: NavLink[] = [
  { label: "Homes", href: "/search?type=sale" },
  { label: "Rentals", href: "/search?type=rent" },
  { label: "Home worth", href: "/home-value" },
  { label: "Local agents", href: "/agents" },
];

/** The main call to action in the header: find the partner agent for a ZIP code. */
export const agentCta: NavLink = { label: "Talk to an agent", href: "/agents" };

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
      { label: "Become a partner agent", href: "/pro" },
      { label: "For landlords", href: "/landlord" },
    ],
  },
  {
    title: "Explore",
    links: [
      { label: "Homes for sale", href: "/search?type=sale" },
      { label: "Homes for rent", href: "/search?type=rent" },
      { label: "Home values", href: "/home-value" },
      { label: "Selling with an agent", href: "/sell" },
    ],
  },
];

export const accountNav: NavLink[] = [
  { label: "Saved homes", href: "/account" },
  { label: "Shared list", href: "/account/shared" },
  { label: "Saved searches", href: "/account/searches" },
  { label: "Tours and inquiries", href: "/account/inquiries" },
  { label: "Rental applications", href: "/account/applications" },
  { label: "My homes", href: "/account/homes" },
  { label: "Settings", href: "/account/settings" },
];
