import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/brand";

const columns = [
  { title: "Build", links: [["Commission an agent", "/activate"], ["Mandate Studio", "/start"], ["Authority Lab", "/lab"], ["Developers", "/developers"], ["Documentation", "/docs"]] },
  { title: "Evaluate", links: [["Product", "/product"], ["Security", "/security"], ["Pricing", "/pricing"], ["Boundary File 001", "/case-studies/procurement-agent"], ["GitHub repository", "https://github.com/meanstackofdoom/capyn"]] },
  { title: "CAPYN", links: [["Design partners", "/design-partners"], ["Private boundary brief", "/design-partners/brief"], ["About", "/about"], ["Control plane", "/dashboard"]] }
] as const;

const actionHrefs = new Set(["/activate", "/start", "/lab", "/design-partners"]);

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="site-container public-footer__grid py-14 lg:grid-cols-[1.2fr_1fr] lg:py-20">
        <div>
          <Brand className="gap-3" />
          <p className="mt-6 max-w-sm text-sm leading-7 text-muted">
            Authority infrastructure for autonomous agents. Delegate capabilities with enforceable limits, approvals and evidence.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 border border-line bg-paper/80 px-3 py-2 font-mono text-[9px] uppercase tracking-[.14em] text-muted">
            <span className="status-dot text-permission" /> Hosted alpha · v0.4
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((column) => (
            <nav key={column.title} aria-label={`${column.title} links`}>
              <p className="font-mono text-[9px] uppercase tracking-[.16em] text-muted">{column.title}</p>
              <div className="public-footer__links mt-5">
                {column.links.map(([label, href]) => (
                  href.startsWith("http") ? (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="public-footer__link"
                    >
                      {label}<ArrowUpRight size={12} aria-hidden="true" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <Link
                      key={href}
                      href={href}
                      className="public-footer__link"
                    >
                      {label}{actionHrefs.has(href) && <ArrowRight size={12} aria-hidden="true" />}
                    </Link>
                  )
                ))}
              </div>
            </nav>
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
