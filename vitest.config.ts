import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // "server-only" throws outside a React server bundle; unit tests import server modules directly.
      "server-only": fileURLToPath(new URL("./tests/unit/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/unit/support/setup.ts"],
    restoreMocks: true,
  },
});
