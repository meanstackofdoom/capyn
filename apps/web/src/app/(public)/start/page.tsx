import { MandateStudio } from "@/components/public/mandate-studio";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Mandate Studio",
  path: "/start",
  description: "Turn one consequential agent action into a saved, testable CAPYN mandate with explicit capabilities, vendors, hard limits, human approval and integration code.",
  keywords: ["AI agent mandate builder", "agent authorization policy", "AI agent spending limits", "human approval workflow"]
});

export default function MandateStudioPage() {
  return <MandateStudio />;
}
