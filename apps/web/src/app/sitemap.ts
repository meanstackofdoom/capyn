import type { MetadataRoute } from "next";
import { publicDocsCatalog } from "@/lib/docs";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010";
  const siteReviewDate = new Date("2026-08-18T00:00:00.000Z");
  const routes = ["", "/start", "/lab", "/case-studies/procurement-agent", "/design-partners", "/product", "/security", "/developers", "/pricing", "/docs", "/about"];
  const publicRoutes: MetadataRoute.Sitemap = routes.map((route, index) => ({
    url: `${siteUrl}${route}`,
    lastModified: siteReviewDate,
    changeFrequency: index === 0 ? "weekly" : "monthly",
    priority: index === 0 ? 1 : 0.8
  }));
  const docRoutes: MetadataRoute.Sitemap = publicDocsCatalog.map((doc) => ({
    url: `${siteUrl}/docs/${doc.slug}`,
    lastModified: new Date(`${doc.reviewedAt}T00:00:00.000Z`),
    changeFrequency: doc.status === "Live" ? "weekly" : "monthly",
    priority: doc.slug === "getting-started" || doc.slug === "security" ? 0.8 : 0.7
  }));
  return [...publicRoutes, ...docRoutes];
}
