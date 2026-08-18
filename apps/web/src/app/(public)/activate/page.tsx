import { SandboxCommissioning } from "@/components/public/sandbox-commissioning";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Commission an Agent",
  path: "/activate",
  description: "Create a sandbox workspace, bind an AI agent, issue a short-lived credential and run its first authenticated policy decision through CAPYN.",
  keywords: ["AI agent sandbox", "agent authorization", "AI agent API key", "agent policy decision"]
});

export default function ActivatePage() {
  return <SandboxCommissioning />;
}
