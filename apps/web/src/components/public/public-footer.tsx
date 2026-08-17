import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/brand";

const columns = [
  { title: "Explore", links: [["Product", "/product"], ["Security", "/security"], ["Pricing", "/pricing"], ["Developers", "/developers"], ["Documentation", "/docs"]] },
  { title: "CAPYN", links: [["About", "/about"], ["Live demo", "/dashboard"], ["Audit log", "/dashboard/audit"]] },
  { title: "Read", links: [["Getting started", "/docs/getting-started"], ["Architecture", "/docs/architecture"], ["Security model", "/docs/security"], ["API reference", "/docs/api"]] }
] as const;

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-panel">
      <div className="site-container grid gap-12 py-14 lg:grid-cols-[1.2fr_1fr] lg:py-20">
        <div>
          <Brand />
          <p className="mt-6 max-w-sm text-sm leading-7 text-muted">
            Authority infrastructure for autonomous agents. Delegate capabilities with enforceable limits, approvals and evidence.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 border border-line bg-paper px-3 py-2 font-mono text-[9px] uppercase tracking-[.14em] text-muted">
            <span className="status-dot text-permission" /> Developer MVP · v0.1
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((column) => (
            <div key={column.title}>
              <p className="font-mono text-[9px] uppercase tracking-[.16em] text-muted">{column.title}</p>
              <div className="mt-5 grid gap-3">
                {column.links.map(([label, href]) => (
                  <Link key={href} href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-authority">
                    {label}{label === "Live demo" && <ArrowUpRight size={12} />}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="site-container flex flex-col justify-between gap-3 py-5 font-mono text-[9px] uppercase tracking-[.12em] text-muted sm:flex-row">
          <span>CAPYN · Built for bounded delegation</span>
          <span>ALLOW / DENY / REQUIRE_APPROVAL</span>
        </div>
      </div>
    </footer>
  );
}
