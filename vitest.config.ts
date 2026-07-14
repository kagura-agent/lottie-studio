import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    exclude: ["node_modules", ".next", "dist", "e2e"],
    setupFiles: ["./src/__tests__/setup.ts"],
  },
});
