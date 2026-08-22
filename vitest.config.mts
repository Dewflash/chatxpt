import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(process.cwd(), "src"),
      "server-only": resolve(process.cwd(), "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.ts",
      "desktop/**/*.test.mjs",
    ],
  },
});
