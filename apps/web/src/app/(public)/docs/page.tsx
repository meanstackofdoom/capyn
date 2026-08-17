import Link from "next/link";
import { ArrowRight, BookOpenCheck, Braces, Fingerprint, ShieldCheck, SquareTerminal } from "lucide-react";
import { DOC_CATEGORIES, publicDocsCatalog } from "@/lib/docs";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Documentation",
  path: "/docs",
  description: "Canonical CAPYN documentation for developers and security reviewers: getting started, API, billing, policy engine, architecture, security and deployment."
});

const categoryCopy = {
  Start: "Install, configure and run CAPYN locally.",
  Build: "Understand the contracts and implementation boundaries.",
  Trust: "Inspect controls, operations and documentation discipline.",
  Direction: "Track the thesis, completion boundary and settlement roadmap."
} as const;

const entryPoints = [
  { href: "/docs/getting-started", label: "Run CAPYN locally", detail: "Demo → API → dashboard", icon: SquareTerminal },
  { href: "/docs/security", label: "Review security", detail: "Controls → limits → production gate", icon: ShieldCheck },
  { href: "/docs/api", label: "Inspect the API", detail: "Intent → decision → evidence", icon: Braces }
] as const;

export default function DocsIndexPage() {
  return (
    <main>
      <section className="page-hero overflow-hidden border-b border-line">
        <div className="authority-field pointer-events-none absolute inset-0 -z-10" />
        <div className="site-container grid min-h-[610px] items-center gap-14 py-20 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-authority">Documentation / evidence register</p>
            <h1 className="display-title mt-7 max-w-3xl text-balance text-5xl font-semibold tracking-[-.065em] sm:text-6xl lg:text-[74px] lg:leading-[.98]">
              The implementation is the claim.
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-muted sm:text-lg">
              Canonical guides for building with CAPYN, evaluating its security boundary and knowing exactly what is—and is not—complete.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link className="public-primary-button" href="/docs/getting-started">Start locally <ArrowRight size={14} /></Link>
              <Link className="public-secondary-button" href="/docs/security">Inspect security</Link>
            </div>
          </div>

          <div className="border border-line bg-panel shadow-control">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-2 text-xs font-extrabold"><Fingerprint size={15} className="text-authority" /> Documentation evidence</div>
              <span className="font-mono text-[9px] uppercase tracking-[.14em] text-permission">Synchronized</span>
            </div>
            <div className="grid gap-px bg-line">
              {[
                ["Canonical source", "/docs/*.md"],
                ["Public renderer", "/docs/[slug]"],
                ["Consistency gate", "pnpm docs:check"],
                ["Public records", `${publicDocsCatalog.length} documents`]
              ].map(([label, value]) => (
                <div className="grid grid-cols-[1fr_auto] items-center gap-4 bg-panel px-5 py-4" key={label}>
                  <span className="text-xs text-muted">{label}</span>
                  <span className="font-mono text-[10px] font-semibold">{value}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-line bg-code px-5 py-5 text-white">
              <p className="font-mono text-[9px] uppercase tracking-[.16em] text-white/50">Latest reviewed records</p>
              <div className="mt-4 grid gap-3">
                {publicDocsCatalog.slice(0, 4).map((doc, index) => (
                  <div className="flex items-center gap-3 text-xs" key={doc.slug}>
                    <span className="font-mono text-[9px] text-white/35">{String(index + 1).padStart(2, "0")}</span>
                    <span className="flex-1 font-semibold">{doc.title}</span>
                    <span className="font-mono text-[8px] uppercase tracking-[.12em] text-permission">{doc.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-panel">
        <div className="site-container grid gap-px bg-line md:grid-cols-3">
          {entryPoints.map(({ href, label, detail, icon: Icon }) => (
            <Link className="group bg-panel px-6 py-7 transition-colors hover:bg-wash" href={href} key={href}>
              <div className="flex items-start justify-between gap-5">
                <Icon size={18} className="text-authority" />
                <ArrowRight size={14} className="text-muted transition-transform group-hover:translate-x-1" />
              </div>
              <p className="mt-7 text-sm font-extrabold">{label}</p>
              <p className="mt-2 font-mono text-[9px] text-muted">{detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <div className="mb-14 max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted">Complete register</p>
            <h2 className="display-title mt-5 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Read by the decision you need to make.</h2>
          </div>
          <div className="grid gap-14">
            {DOC_CATEGORIES.map((category) => (
              <section className="grid gap-6 lg:grid-cols-[220px_1fr]" key={category}>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[.18em] text-authority">{category}</p>
                  <p className="mt-3 max-w-[190px] text-xs leading-6 text-muted">{categoryCopy[category]}</p>
                </div>
                <div className="border-t border-line">
                  {publicDocsCatalog.filter((doc) => doc.category === category).map((doc) => (
                    <Link className="group grid gap-3 border-b border-line py-6 sm:grid-cols-[1fr_auto] sm:items-center" href={`/docs/${doc.slug}`} key={doc.slug}>
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-base font-extrabold group-hover:text-authority">{doc.title}</h3>
                          <span className="border border-line bg-panel px-2 py-1 font-mono text-[8px] uppercase tracking-[.12em] text-muted">{doc.status}</span>
                        </div>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{doc.description}</p>
                      </div>
                      <ArrowRight size={15} className="text-muted transition-transform group-hover:translate-x-1 group-hover:text-authority" />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-code text-white">
        <div className="site-container grid gap-8 py-14 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex gap-4">
            <BookOpenCheck size={22} className="mt-1 shrink-0 text-permission" />
            <div>
              <h2 className="display-title text-3xl font-semibold tracking-[-.04em]">Documentation fails the build when it drifts.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">Every canonical file is catalogued, linked and rendered from the repository source. Authority changes require documentation review.</p>
            </div>
          </div>
          <Link className="inline-flex min-h-11 items-center justify-center gap-2 border border-white/25 px-4 text-xs font-bold hover:border-white/60" href="/docs/documentation">
            Read the policy <ArrowRight size={13} />
          </Link>
        </div>
      </section>
    </main>
  );
}
