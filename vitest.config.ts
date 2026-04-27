import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.resolve(import.meta.dirname);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@shared": path.resolve(root, "shared"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [
      ["src/**/*.test.{ts,tsx}", "jsdom"],
    ],
    setupFiles: ["./vitest.setup.ts"],
    fileParallelism: false,
  },
});
