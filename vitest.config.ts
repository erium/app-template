import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const root = path.resolve(import.meta.dirname);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(root, "client", "src"),
      "@shared": path.resolve(root, "shared"),
    },
  },
  test: {
    globals: true,
    // Default to node; client test files opt into jsdom automatically
    environment: "node",
    environmentMatchGlobs: [
      ["client/**/*.test.{ts,tsx}", "jsdom"],
    ],
    setupFiles: ["./vitest.setup.ts"],
    // Integration tests hit the real DB sequentially to avoid conflicts
    fileParallelism: false,
  },
});
