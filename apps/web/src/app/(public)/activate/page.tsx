import { SandboxCommissioning } from "@/components/public/sandbox-commissioning";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Commission an Agent",
  path: "/activate",
  description: "Commission an AI agent, prove its first authenticated policy decision, then claim the exact boundary into a durable CAPYN workspace.",
  keywords: ["AI agent sandbox", "agent onboarding", "agent authorization", "AI agent API key", "agent policy decision"]
});

export default function ActivatePage() {
  return <SandboxCommissioning />;
}
