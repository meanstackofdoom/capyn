import { ImageResponse } from "next/og";

export const alt = "CAPYN — Give agents authority. Not unlimited access.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ background: "#f3f7f9", color: "#0a1824", display: "flex", flexDirection: "column", fontFamily: "sans-serif", height: "100%", padding: "58px 68px", position: "relative", width: "100%" }}>
      <div style={{ backgroundImage: "repeating-linear-gradient(90deg,transparent 0,transparent 95px,#d7e0e5 96px)", inset: 0, opacity: 0.65, position: "absolute" }} />
      <div style={{ alignItems: "center", display: "flex", gap: 16, position: "relative" }}>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "center", width: 46, height: 46 }}>
          <svg viewBox="0 0 44 44" width={46} height={46} fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="38" height="38" rx="11" fill="rgba(10,24,36,0.055)" stroke="#0a1824" strokeWidth="1.7" />
            <rect x="12" y="12" width="20" height="20" rx="5" fill="rgba(10,24,36,0.06)" stroke="#0a1824" strokeWidth="1.4" />
            <path d="M12 32h11.4a7 7 0 1 0 0-14H12" stroke="#0a1824" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 21l7 4.5-7 4.5M15 34h-5" stroke="#2f62dd" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "0.15em" }}>CAPYN</div>
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 75, fontWeight: 750, letterSpacing: "-0.065em", lineHeight: 0.96, maxWidth: 940 }}><span>Give agents authority.</span><span style={{ color: "#627381" }}>Not unlimited access.</span></div>
        <div style={{ color: "#627381", fontSize: 22, lineHeight: 1.5, marginTop: 34, maxWidth: 760 }}>Capabilities, hard limits, request-bound approvals and audit evidence before autonomous actions execute.</div>
      </div>
      <div style={{ alignItems: "center", borderTop: "1px solid #d7e0e5", display: "flex", fontFamily: "monospace", fontSize: 14, justifyContent: "space-between", paddingTop: 22, position: "relative" }}><span style={{ color: "#2f62dd" }}>AUTHORITY CONTROL PLANE</span><span style={{ color: "#627381" }}>ALLOW / DENY / REQUIRE_APPROVAL</span></div>
    </div>,
    size
  );
}
