export function CapynMark({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <span className={`capyn-mark ${compact ? "h-7 w-7" : "h-8 w-8"} ${className}`}>
      <svg viewBox="0 0 44 44" fill="none" aria-hidden="true" focusable="false">
        <rect
          x="5"
          y="5"
          width="34"
          height="34"
          rx="11"
          className="capyn-mark__frame"
        />
        <rect
          x="14"
          y="14"
          width="16"
          height="16"
          rx="5"
          className="capyn-mark__inner"
        />
        <path
          d="M14 28h11.4a7 7 0 1 0 0-14H14"
          className="capyn-mark__glyph"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M22 17l7 4.5-7 4.5M17 30h-5"
          className="capyn-mark__signal"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
