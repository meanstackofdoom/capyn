import type { Metadata } from "next";

interface PageMetadataInput {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: string;
  keywords?: string[];
}

export function createPageMetadata(input: PageMetadataInput): Metadata {
  const socialTitle = input.absoluteTitle ?? `${input.title} · CAPYN`;
  return {
    title: input.absoluteTitle ? { absolute: input.absoluteTitle } : input.title,
    description: input.description,
    alternates: { canonical: input.path },
    ...(input.keywords ? { keywords: input.keywords } : {}),
    openGraph: {
      type: "website",
      url: input.path,
      title: socialTitle,
      description: input.description,
      siteName: "CAPYN"
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: input.description
    }
  };
}
