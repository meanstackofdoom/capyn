import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromHere = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@capyn/types": fromHere("../../packages/types/src/index.ts"),
      "@capyn/billing": fromHere("../../packages/billing/src/index.ts"),
      "@capyn/policy-engine": fromHere("../../packages/policy-engine/src/index.ts"),
      "@capyn/database": fromHere("../../packages/database/src/index.ts")
    }
  },
  test: {
    environment: "node",
    clearMocks: true
  }
});
