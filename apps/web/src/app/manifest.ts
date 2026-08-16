import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CAPYN — Authority infrastructure for autonomous agents",
    short_name: "CAPYN",
    description: "Delegate capabilities to AI agents with policies, limits, approvals and audit evidence.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f7f9",
    theme_color: "#0a1824"
  };
}
