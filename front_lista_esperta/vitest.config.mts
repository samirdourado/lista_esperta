import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx", "app/**/*.test.tsx"],
    // Component tests opt into jsdom with a `// @vitest-environment jsdom` comment.
    environment: "node",
    setupFiles: ["./test/setup.ts"],
  },
});
