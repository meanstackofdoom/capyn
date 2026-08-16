import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import catalogSource from "../../../../docs/catalog.json";

export const DOC_CATEGORIES = ["Start", "Build", "Trust", "Direction"] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

export interface DocMetadata {
  slug: string;
  file: string;
  title: string;
  description: string;
  category: DocCategory;
  status: string;
  reviewedAt: string;
  order: number;
}

export interface TableOfContentsItem {
  id: string;
  title: string;
  level: 2 | 3;
}

export interface DocPage extends DocMetadata {
  source: string;
  readingMinutes: number;
  tableOfContents: TableOfContentsItem[];
}

export const docsCatalog = [...(catalogSource as DocMetadata[])].sort((left, right) => left.order - right.order);

const docsDirectory = path.resolve(process.cwd(), "..", "..", "docs");

export function slugifyHeading(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function tableOfContents(source: string): TableOfContentsItem[] {
  const seen = new Map<string, number>();
  return [...source.matchAll(/^(##|###)\s+(.+)$/gm)].map((match) => {
    const title = match[2]?.trim() ?? "Section";
    const base = slugifyHeading(title);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return {
      id: count === 0 ? base : `${base}-${count + 1}`,
      title,
      level: match[1] === "###" ? 3 : 2
    };
  });
}

export const getDoc = cache(async (slug: string): Promise<DocPage | null> => {
  const metadata = docsCatalog.find((entry) => entry.slug === slug);
  if (!metadata) return null;
  const rawSource = await readFile(path.join(docsDirectory, metadata.file), "utf8");
  const source = rawSource.replace(/^#\s+.+\r?\n+/, "");
  const words = source.trim().split(/\s+/).filter(Boolean).length;
  return {
    ...metadata,
    source,
    readingMinutes: Math.max(1, Math.ceil(words / 220)),
    tableOfContents: tableOfContents(source)
  };
});

export function docRouteForMarkdown(href: string): string {
  const [target = "", hash] = href.split("#", 2);
  if (!target) return hash ? `#${hash}` : href;
  const file = target.split("/").at(-1);
  const matchingDoc = docsCatalog.find((entry) => entry.file === file);
  if (!matchingDoc) return href;
  return `/docs/${matchingDoc.slug}${hash ? `#${hash}` : ""}`;
}
