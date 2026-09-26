import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Providers } from "@/components/layout/Providers";
import { brand } from "@/config/brand";
import "./globals.css";

// Self hosted so builds never depend on a font CDN.
// Jost for text and interface, Bodoni Moda for headings (CLAUDE.md brand config).
const sans = localFont({
  src: "../../node_modules/@fontsource-variable/jost/files/jost-latin-wght-normal.woff2",
  variable: "--font-sans",
  weight: "100 900",
  display: "swap",
});
const display = localFont({
  src: "../../node_modules/@fontsource-variable/bodoni-moda/files/bodoni-moda-latin-wght-normal.woff2",
  variable: "--font-display",
  weight: "400 900",
  display: "swap",
  // Only headings use it; the body font is the one to preload.
  preload: false,
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${brand.domain}`;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: `${brand.name}: homes for sale, rentals and home values`, template: `%s | ${brand.name}` },
  description: `Search homes for sale and for rent in ${brand.market.region}, see what any home is worth, and connect with local agents.`,
  applicationName: brand.name,
  openGraph: { type: "website", siteName: brand.name, locale: "en_CA" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B1B3F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" className={`${sans.variable} ${display.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow-raised"
        >
          Skip to content
        </a>
        <Providers>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
