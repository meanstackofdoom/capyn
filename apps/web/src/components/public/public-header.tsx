"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";

const navigation = [
  { href: "/lab", label: "Authority Lab" },
  { href: "/product", label: "Product" },
  { href: "/security", label: "Security" },
  { href: "/developers", label: "Developers" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/about", label: "About" }
] as const;

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className={`public-header sticky top-0 z-50 border-b border-line/80 bg-paper/90 backdrop-blur-xl ${pathname === "/" || pathname === "/lab" ? "public-header-home" : ""}`}>
      <div className="site-container flex h-[72px] items-center justify-between gap-5">
        <Brand />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Public website">
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`border px-3.5 py-2 text-[13px] font-semibold transition-colors ${active ? "border-line bg-panel text-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/lab" className="public-primary-button public-header__desktop-cta hidden sm:inline-flex">
            Run a decision <ArrowRight size={14} />
          </Link>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center border border-line bg-panel lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-line bg-panel lg:hidden">
          <nav className="site-container grid gap-px py-3" aria-label="Mobile website">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "page" : undefined} className="flex min-h-12 items-center justify-between border-b border-line/60 text-sm font-semibold last:border-0">
                {item.label}<ArrowRight size={14} className="text-muted" />
              </Link>
            ))}
            <Link href="/lab" className="public-primary-button mt-3 justify-center sm:hidden">
              Run a decision <ArrowRight size={14} />
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
