import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen overflow-x-clip">
      <a href="#public-content" className="fixed left-3 top-3 z-[100] -translate-y-20 bg-ink px-4 py-3 text-xs font-bold text-paper transition-transform focus:translate-y-0">
        Skip to content
      </a>
      <PublicHeader />
      <div id="public-content" tabIndex={-1} className="outline-none">{children}</div>
      <PublicFooter />
    </div>
  );
}
