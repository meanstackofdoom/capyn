import type { ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUpRight } from "lucide-react";
import { docRouteForMarkdown, slugifyHeading } from "@/lib/docs";

function plainText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(plainText).join("");
  return "";
}

const components: Components = {
  h2: ({ children }) => <h2 id={slugifyHeading(plainText(children))}>{children}</h2>,
  h3: ({ children }) => <h3 id={slugifyHeading(plainText(children))}>{children}</h3>,
  a: ({ children, href = "" }) => {
    if (/^https?:\/\//i.test(href)) {
      return <a href={href} rel="noreferrer" target="_blank">{children}<ArrowUpRight aria-hidden="true" size={11} /></a>;
    }
    return <Link href={docRouteForMarkdown(href)}>{children}</Link>;
  }
};

export function MarkdownDocument({ source }: { source: string }) {
  return (
    <article className="docs-prose">
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </article>
  );
}
