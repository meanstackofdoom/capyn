import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CircleDot, Clock3, FileText } from "lucide-react";
import { DocsSidebar } from "@/components/public/docs-sidebar";
import { MarkdownDocument } from "@/components/public/markdown-document";
import { docsCatalog, getDoc } from "@/lib/docs";
import { createPageMetadata } from "@/lib/metadata";

export function generateStaticParams() {
  return docsCatalog.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = docsCatalog.find((entry) => entry.slug === slug);
  if (!doc) return {};
  return createPageMetadata({
    title: doc.title,
    description: doc.description,
    path: `/docs/${doc.slug}`
  });
}

export default async function DocumentationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc) notFound();

  return (
    <main>
      <div className="border-b border-line bg-panel">
        <div className="site-container py-5">
          <Link className="inline-flex items-center gap-2 text-xs font-bold text-muted hover:text-ink" href="/docs">
            <ArrowLeft size={13} /> Documentation index
          </Link>
        </div>
      </div>

      <div className="site-container py-10 lg:py-16">
        <DocsSidebar activeSlug={doc.slug} mobile />
        <div className="mt-9 grid gap-12 lg:mt-0 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,760px)_210px] xl:gap-16">
          <DocsSidebar activeSlug={doc.slug} />

          <div className="min-w-0">
            <header className="border-b border-line pb-10">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[.14em]">
                <span className="text-authority">{doc.category}</span>
                <span className="text-line">/</span>
                <span className="text-muted">{doc.status}</span>
              </div>
              <h1 className="display-title mt-6 text-balance text-4xl font-semibold tracking-[-.055em] sm:text-5xl lg:text-6xl">{doc.title}</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-muted">{doc.description}</p>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 font-mono text-[9px] uppercase tracking-[.11em] text-muted">
                <span className="inline-flex items-center gap-2"><CalendarDays size={12} /> Reviewed {doc.reviewedAt}</span>
                <span className="inline-flex items-center gap-2"><Clock3 size={12} /> {doc.readingMinutes} min read</span>
                <span className="inline-flex items-center gap-2"><FileText size={12} /> {doc.file}</span>
              </div>
            </header>
            <div className="pt-10"><MarkdownDocument source={doc.source} /></div>
          </div>

          <aside className="hidden xl:block">
            <div className="sticky top-28">
              <p className="mb-4 font-mono text-[9px] uppercase tracking-[.16em] text-muted">On this page</p>
              <nav className="grid gap-2 border-l border-line" aria-label="On this page">
                {doc.tableOfContents.filter((item) => item.level === 2).map((item) => (
                  <a className="border-l border-transparent py-1 pl-4 text-[11px] leading-5 text-muted hover:border-authority hover:text-ink" href={`#${item.id}`} key={item.id}>{item.title}</a>
                ))}
              </nav>
              <div className="mt-9 border border-line bg-panel p-4">
                <p className="flex items-center gap-2 text-xs font-extrabold"><CircleDot size={13} className="text-permission" /> Evidence status</p>
                <p className="mt-3 text-[11px] leading-5 text-muted">Rendered from the canonical repository document and validated by `pnpm docs:check`.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
