import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{
      alignItems: "center",
      background: "#0a1824",
      color: "#f3f7f9",
      display: "flex",
      fontFamily: "sans-serif",
      height: "100%",
      justifyContent: "center",
      position: "relative",
      width: "100%"
    }}>
      <svg viewBox="0 0 44 44" width="64%" height="64%" fill="none">
        <rect x="3" y="3" width="38" height="38" rx="11" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.7" />
        <rect x="12" y="12" width="20" height="20" rx="5" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.75)" strokeWidth="1.4" />
        <path d="M12 32h11.4a7 7 0 1 0 0-14H12" stroke="rgba(255,255,255,0.95)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 21l7 4.5-7 4.5M15 34h-5" stroke="rgba(47,98,221,0.9)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>,
    size
  );
}
