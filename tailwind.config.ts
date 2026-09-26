import type { Config } from "tailwindcss";

// Design tokens from docs/04 section 2. Colors come from the brand block via src/styles/brand.css.
// Loaded by src/app/globals.css through the Tailwind v4 @config directive.
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["40px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "600" }],
        h1: ["28px", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" }],
        h2: ["22px", { lineHeight: "1.25", fontWeight: "600" }],
        h3: ["17px", { lineHeight: "1.3", fontWeight: "600" }],
        body: ["15px", { lineHeight: "1.5" }],
        small: ["13px", { lineHeight: "1.45" }],
        label: ["12px", { lineHeight: "1.3", letterSpacing: "0.02em", fontWeight: "500" }],
        price: ["24px", { lineHeight: "1.1", fontWeight: "700" }],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)",
        raised: "0 8px 24px rgba(0,0,0,0.08)",
      },
      colors: {
        success: "#16A34A",
        warning: "#D97706",
        danger: "#DC2626",
      },
      maxWidth: {
        container: "1280px",
      },
    },
  },
} satisfies Config;
