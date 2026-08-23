"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/brand";

const navigation = [
  { href: "/activate", label: "Commission" },
  { href: "/start", label: "Mandate Studio" },
  { href: "/lab", label: "Authority Lab" },
  { href: "/developers", label: "Developers" },
  { href: "/design-partners", label: "Design partners" }
] as const;

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const showHomeStyles = ["/", "/activate", "/lab", "/start", "/proof", "/passport"].includes(pathname);
  const showProofStyles = ["/proof", "/passport"].includes(pathname);
  let primaryAction = { href: "/activate", label: "Run first decision" };
  if (pathname === "/activate") primaryAction = { href: "/developers", label: "Read the API guide" };
  if (pathname === "/start") primaryAction = { href: "/lab", label: "Run live policy" };
  if (pathname === "/passport") primaryAction = { href: "/start", label: "Build a passport" };
  if (pathname === "/proof") primaryAction = { href: "/lab", label: "Generate a receipt" };
  if (pathname === "/design-partners") primaryAction = { href: "/design-partners/brief", label: "Draft a brief" };
  if (pathname === "/design-partners/brief") primaryAction = { href: "/lab", label: "Rehearse live" };

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;

    const firstLink = mobileMenuRef.current?.querySelector<HTMLAnchorElement>("a");
    const focusFrame = window.requestAnimationFrame(() => firstLink?.focus());

    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButtonRef.current?.focus();
    }

    function closeOutside(event: PointerEvent): void {
      if (headerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    function closeAtDesktop(event: MediaQueryListEvent): void {
      if (event.matches) setOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOutside);
    desktopQuery.addEventListener("change", closeAtDesktop);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOutside);
      desktopQuery.removeEventListener("change", closeAtDesktop);
    };
  }, [open]);

  return (
    <header
      ref={headerRef}
      className={`public-header sticky top-0 z-50 border-b border-line/80 bg-paper/90 backdrop-blur-xl ${showHomeStyles ? "public-header-home" : ""} ${showProofStyles ? "public-header-proof" : ""}`}
    >
      <div className="site-container flex h-[72px] items-center justify-between gap-5">
        <Brand />
        <nav className="hidden items-center gap-2 lg:flex" aria-label="Public website">
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`public-header__link ${active ? "public-header__link--active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href={primaryAction.href} className="public-primary-button public-header__desktop-cta hidden sm:inline-flex">
            {primaryAction.label} <ArrowRight size={14} />
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            className="public-header__menu-button grid h-11 w-11 place-items-center border border-line bg-panel/85 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="public-mobile-menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <div ref={mobileMenuRef} id="public-mobile-menu" className="public-header__mobile-menu border-t border-line bg-panel lg:hidden">
          <nav className="site-container grid gap-px py-3" aria-label="Mobile website">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "page" : undefined}
                className="public-header__mobile-link"
              >
                {item.label}
                <ArrowRight size={14} className="text-muted" />
              </Link>
            ))}
            <Link href={primaryAction.href} className="public-primary-button mt-3 justify-center sm:hidden">
              {primaryAction.label} <ArrowRight size={14} />
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
