import type { Config } from "tailwindcss";

// Design tokens from docs/04 section 2. Colors come from the brand block via src/styles/brand.css.
// Loaded by src/app/globals.css through the Tailwind v4 @config directive.
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "ui-serif", "serif"],
      },
      fontSize: {
        display: ["52px", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "600" }],
        h1: ["32px", { lineHeight: "1.15", letterSpacing: "-0.01em", fontWeight: "600" }],
        h2: ["24px", { lineHeight: "1.25", letterSpacing: "-0.005em", fontWeight: "600" }],
        h3: ["18px", { lineHeight: "1.3", fontWeight: "500" }],
        body: ["16px", { lineHeight: "1.55" }],
        small: ["14px", { lineHeight: "1.45" }],
        label: ["12px", { lineHeight: "1.3", letterSpacing: "0.02em", fontWeight: "500" }],
        price: ["24px", { lineHeight: "1.1", fontWeight: "700" }],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        pill: "999px",
      },
      boxShadow: {
        // Warm, soft elevation (stone tinted) instead of flat grey drop shadows.
        card: "0 1px 2px rgba(28,25,23,0.04), 0 2px 8px rgba(28,25,23,0.05)",
        raised: "0 12px 32px rgba(28,25,23,0.10), 0 2px 6px rgba(28,25,23,0.04)",
        glow: "0 0 0 1px rgba(161,98,7,0.18), 0 10px 30px rgba(245,158,11,0.18)",
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
