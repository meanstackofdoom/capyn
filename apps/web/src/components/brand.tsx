import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-3" aria-label="CAPYN home">
      <span className="relative grid h-8 w-8 place-items-center border border-ink/20 bg-panel font-mono text-[10px] font-medium tracking-[-.08em] shadow-sm transition-transform group-hover:-translate-y-0.5">
        C/
        <span className="absolute -bottom-px -right-px h-2 w-2 bg-permission" />
      </span>
      {!compact && <span className="text-[15px] font-extrabold tracking-[0.16em]">CAPYN</span>}
    </Link>
  );
}
