import Link from "next/link";
import { CapynMark } from "./capyn-logo";

export function Brand({
  compact = false,
  className = ""
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-3 ${className}`} aria-label="CAPYN home">
      <CapynMark compact={compact} className="capyn-brand__icon" />
      {!compact && <span className="capyn-brand__wordmark">CAPYN</span>}
    </Link>
  );
}
