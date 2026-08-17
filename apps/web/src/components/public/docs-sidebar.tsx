import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { DOC_CATEGORIES, publicDocsCatalog } from "@/lib/docs";

interface DocsSidebarProps {
  activeSlug?: string;
  mobile?: boolean;
}

function DocsNavigation({ activeSlug }: { activeSlug: string | undefined }) {
  return (
    <nav aria-label="Documentation">
      {DOC_CATEGORIES.map((category) => (
        <div className="mb-7 last:mb-0" key={category}>
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[.16em] text-muted">{category}</p>
          <div className="grid gap-px">
            {publicDocsCatalog.filter((doc) => doc.category === category).map((doc) => {
              const active = doc.slug === activeSlug;
              return (
                <Link
                  className={`group flex min-h-9 items-center justify-between border-l px-3 py-2 text-[12px] font-semibold transition-colors ${active ? "border-authority bg-authority/5 text-authority" : "border-line text-muted hover:border-muted hover:text-ink"}`}
                  href={`/docs/${doc.slug}`}
                  key={doc.slug}
                >
                  <span>{doc.title}</span>
                  {active && <span className="status-dot text-authority" />}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function DocsSidebar({ activeSlug, mobile = false }: DocsSidebarProps) {
  if (mobile) {
    return (
      <details className="border border-line bg-panel lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-xs font-bold">
          <span className="flex items-center gap-2"><BookOpen size={14} /> Browse documentation</span>
          <ArrowRight size={13} />
        </summary>
        <div className="border-t border-line p-4"><DocsNavigation activeSlug={activeSlug} /></div>
      </details>
    );
  }

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-28">
        <Link href="/docs" className="mb-7 flex items-center gap-2 text-xs font-extrabold">
          <BookOpen size={14} className="text-authority" /> Documentation index
        </Link>
        <DocsNavigation activeSlug={activeSlug} />
      </div>
    </aside>
  );
}
