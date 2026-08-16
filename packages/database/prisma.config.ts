import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

try {
  process.loadEnvFile?.(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // CI and production supply DATABASE_URL through the process environment.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx src/seed.ts"
  }
});
