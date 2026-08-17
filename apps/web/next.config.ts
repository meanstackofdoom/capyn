import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile?.(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // Defaults keep the web app buildable without a local environment file.
}

const development = process.env.NODE_ENV !== "production";
const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010");
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").origin;
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${apiOrigin}${development ? " http: https: ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  ...(siteUrl.protocol === "https:" ? ["upgrade-insecure-requests"] : [])
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@capyn/types", "@capyn/billing"],
  poweredByHeader: false,
  images: { qualities: [75, 90] },
  // Keep static generation predictable on constrained CI and single-service hosts.
  experimental: { cpus: 1 },
  async headers() {
    return [
      {
        source: "/private/project-status",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" }
        ]
      },
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(siteUrl.protocol === "https:"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : [])
        ]
      }
    ];
  },
  // The monorepo root runs the stricter flat-config lint pass before every CI build.
  eslint: { ignoreDuringBuilds: true }
};

export default nextConfig;
