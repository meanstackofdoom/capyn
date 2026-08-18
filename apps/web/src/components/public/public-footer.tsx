import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/brand";

const columns = [
  { title: "Explore", links: [["Mandate Studio", "/start"], ["Authority Passport", "/passport"], ["Authority Lab", "/lab"], ["Proof viewer", "/proof"], ["Product", "/product"], ["Security", "/security"], ["Pricing", "/pricing"], ["Developers", "/developers"], ["Documentation", "/docs"]] },
  { title: "CAPYN", links: [["Boundary File 001", "/case-studies/procurement-agent"], ["Design partners", "/design-partners"], ["Private boundary brief", "/design-partners/brief"], ["About", "/about"], ["Control plane", "/dashboard"], ["Audit log", "/dashboard/audit"]] },
  { title: "Read", links: [["Getting started", "/docs/getting-started"], ["Architecture", "/docs/architecture"], ["Security model", "/docs/security"], ["API reference", "/docs/api"], ["GitHub repository", "https://github.com/meanstackofdoom/capyn"]] }
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
            <span className="status-dot text-permission" /> Developer alpha · v0.2
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((column) => (
            <div key={column.title}>
              <p className="font-mono text-[9px] uppercase tracking-[.16em] text-muted">{column.title}</p>
              <div className="mt-5 grid gap-3">
                {column.links.map(([label, href]) => (
                  href.startsWith("http") ? (
                    <a key={href} href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-authority">
                      {label}<ArrowUpRight size={12} />
                    </a>
                  ) : (
                    <Link key={href} href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-authority">
                      {label}{(["Mandate Studio", "Authority Passport", "Authority Lab", "Proof viewer"] as string[]).includes(label) && <ArrowUpRight size={12} />}
                    </Link>
                  )
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
