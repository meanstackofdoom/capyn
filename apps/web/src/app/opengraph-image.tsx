import { ImageResponse } from "next/og";

export const alt = "CAPYN — Give agents authority. Not unlimited access.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ background: "#f3f7f9", color: "#0a1824", display: "flex", flexDirection: "column", fontFamily: "sans-serif", height: "100%", padding: "58px 68px", position: "relative", width: "100%" }}>
      <div style={{ backgroundImage: "repeating-linear-gradient(90deg,transparent 0,transparent 95px,#d7e0e5 96px)", inset: 0, opacity: 0.65, position: "absolute" }} />
      <div style={{ alignItems: "center", display: "flex", gap: 16, position: "relative" }}>
        <div style={{ alignItems: "center", border: "2px solid #0a1824", display: "flex", fontSize: 18, fontWeight: 800, height: 46, justifyContent: "center", position: "relative", width: 46 }}>C/<div style={{ background: "#2f62dd", bottom: -2, height: 10, position: "absolute", right: -2, width: 10 }} /></div>
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
