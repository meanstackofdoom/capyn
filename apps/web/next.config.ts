import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile?.(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // Defaults keep the web app buildable without a local environment file.
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@capyn/types"],
  poweredByHeader: false,
  // The monorepo root runs the stricter flat-config lint pass before every CI build.
  eslint: { ignoreDuringBuilds: true }
};

export default nextConfig;
