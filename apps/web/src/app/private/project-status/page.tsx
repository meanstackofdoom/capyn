import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, FileLock2, KeyRound, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { MarkdownDocument } from "@/components/public/markdown-document";
import { getDoc, PROJECT_STATUS_SLUG } from "@/lib/docs";
import {
  isProjectStatusAuthConfigured,
  PROJECT_STATUS_COOKIE,
  verifyProjectStatusSession
} from "@/lib/project-status-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Private project status",
  description: "Restricted CAPYN project status record.",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
  referrer: "no-referrer"
};

interface PageProps {
  searchParams: Promise<{ error?: string | string[] }>;
}

function AccessGate({ invalid, configured }: { invalid: boolean; configured: boolean }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-code text-white">
      <div className="authority-field-dark pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex min-h-screen w-[min(100%-2.5rem,1180px)] flex-col py-7 sm:py-10">
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="[--ink:#edf4f1] [--panel:#0e1b25]"><Brand /></div>
          <span className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.16em] text-white/45">
            <span className="status-dot text-review" /> Restricted record
          </span>
        </div>

        <div className="grid flex-1 items-center gap-14 py-16 lg:grid-cols-[1fr_480px] lg:gap-24">
          <section className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-review">Private boundary / owner access</p>
            <h1 className="display-title mt-7 text-balance text-5xl font-semibold leading-[.98] tracking-[-.065em] sm:text-6xl lg:text-[76px]">
              Status stays behind the boundary.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-white/58">
              The public site explains the product. This sealed record tracks internal completion, launch actions and the production gate.
            </p>
          </section>

          <section className="border border-white/15 bg-white/[.035] shadow-[0_32px_100px_rgba(0,0,0,.28)]" aria-labelledby="access-title">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center border border-white/15"><LockKeyhole size={15} className="text-review" /></span>
                <div>
                  <p id="access-title" className="text-xs font-extrabold">Unlock status ledger</p>
                  <p className="mt-1 font-mono text-[8px] uppercase tracking-[.14em] text-white/35">Server-verified session</p>
                </div>
              </div>
              <FileLock2 size={17} className="text-white/35" />
            </div>

            <div className="grid gap-px bg-white/10 sm:grid-cols-3">
              {[["01", "Credential"], ["02", "Verify"], ["03", "Release"]].map(([step, label]) => (
                <div className="bg-code/90 px-4 py-4" key={step}>
                  <p className="font-mono text-[8px] text-white/30">{step}</p>
                  <p className="mt-2 text-[10px] font-bold text-white/65">{label}</p>
                </div>
              ))}
            </div>

            <form action="/private/project-status/session" method="post" className="p-5 sm:p-6">
              <label className="block font-mono text-[9px] uppercase tracking-[.16em] text-white/48" htmlFor="project-status-password">
                Access password
              </label>
              <div className="mt-3 flex min-h-12 items-center border border-white/15 bg-black/20 focus-within:border-review">
                <KeyRound size={15} className="ml-4 shrink-0 text-white/35" />
                <input
                  autoComplete="current-password"
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-white/22"
                  disabled={!configured}
                  id="project-status-password"
                  name="password"
                  placeholder="Enter the private credential"
                  required
                  type="password"
                />
              </div>
              {invalid && (
                <p className="mt-3 border-l-2 border-denial pl-3 text-xs leading-5 text-denial" role="alert">
                  That credential did not open this record. Check it and try again.
                </p>
              )}
              {!configured && (
                <p className="mt-3 border-l-2 border-review pl-3 text-xs leading-5 text-review" role="alert">
                  Private access is unavailable until the deployment secret is configured.
                </p>
              )}
              <button className="mt-5 inline-flex min-h-12 w-full items-center justify-between bg-white px-4 text-sm font-extrabold text-code transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45" disabled={!configured} type="submit">
                Open private record <ArrowRight size={15} />
              </button>
            </form>

            <div className="flex items-start gap-3 border-t border-white/10 px-5 py-4 text-[10px] leading-5 text-white/38 sm:px-6">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-permission" />
              The credential is checked on the server and stored only as a secure, HTTP-only session cookie.
            </div>
          </section>
        </div>

        <Link className="inline-flex items-center gap-2 self-start text-xs font-bold text-white/45 hover:text-white" href="/">
          <ArrowLeft size={13} /> Return to the public site
        </Link>
      </div>
    </main>
  );
}

export default async function PrivateProjectStatusPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const authorized = verifyProjectStatusSession(cookieStore.get(PROJECT_STATUS_COOKIE)?.value);
  if (!authorized) {
    const query = await searchParams;
    return <AccessGate configured={isProjectStatusAuthConfigured()} invalid={query.error === "invalid"} />;
  }

  const doc = await getDoc(PROJECT_STATUS_SLUG);
  if (!doc) notFound();

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line bg-code text-white">
        <div className="site-container flex min-h-20 items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="[--ink:#edf4f1] [--panel:#0e1b25]"><Brand /></div>
            <span className="hidden h-5 w-px bg-white/15 sm:block" />
            <span className="hidden items-center gap-2 font-mono text-[9px] uppercase tracking-[.15em] text-white/45 sm:inline-flex">
              <span className="status-dot text-permission" /> Private record open
            </span>
          </div>
          <form action="/private/project-status/session" method="post">
            <input name="intent" type="hidden" value="logout" />
            <button className="inline-flex min-h-10 items-center gap-2 border border-white/15 px-3 text-xs font-bold text-white/70 hover:border-white/35 hover:text-white" type="submit">
              Lock record <LogOut size={13} />
            </button>
          </form>
        </div>
      </header>

      <div className="site-container grid gap-12 py-12 lg:grid-cols-[minmax(0,760px)_240px] lg:py-20 xl:gap-20">
        <article className="min-w-0">
          <header className="border-b border-line pb-10">
            <p className="font-mono text-[10px] uppercase tracking-[.17em] text-authority">Owner ledger / restricted</p>
            <h1 className="display-title mt-6 text-balance text-5xl font-semibold tracking-[-.06em] sm:text-6xl">{doc.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-muted">{doc.description}</p>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 font-mono text-[9px] uppercase tracking-[.11em] text-muted">
              <span className="inline-flex items-center gap-2"><CalendarDays size={12} /> Reviewed {doc.reviewedAt}</span>
              <span className="inline-flex items-center gap-2"><Clock3 size={12} /> {doc.readingMinutes} min read</span>
            </div>
          </header>
          <div className="pt-10"><MarkdownDocument source={doc.source} /></div>
        </article>

        <aside>
          <div className="sticky top-8 border border-line bg-panel p-5 shadow-control">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9px] uppercase tracking-[.16em] text-muted">Access state</p>
              <LockKeyhole size={14} className="text-permission" />
            </div>
            <p className="mt-5 text-sm font-extrabold">Session verified</p>
            <p className="mt-2 text-xs leading-6 text-muted">This response is private, uncached and excluded from search indexing.</p>
            <div className="mt-5 border-t border-line pt-5">
              <Link className="inline-flex items-center gap-2 text-xs font-bold hover:text-authority" href="/">
                <ArrowLeft size={13} /> Public site
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
