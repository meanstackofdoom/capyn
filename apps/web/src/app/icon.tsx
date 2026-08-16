import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#0a1824", color: "#f3f7f9", display: "flex", fontFamily: "sans-serif", fontSize: 23, fontWeight: 800, height: "100%", justifyContent: "center", letterSpacing: "-0.08em", position: "relative", width: "100%" }}>
      C/
      <div style={{ background: "#2f62dd", bottom: 0, height: 12, position: "absolute", right: 0, width: 12 }} />
    </div>,
    size
  );
}
