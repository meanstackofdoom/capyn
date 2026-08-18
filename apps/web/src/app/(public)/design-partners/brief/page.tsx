import { BoundaryBriefBuilder } from "@/components/public/boundary-brief-builder";
import { isContactEmail } from "@/lib/boundary-brief";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Private boundary brief",
  path: "/design-partners/brief",
  description: "Draft one consequential agent action in your browser, then copy, download or privately transfer the brief without submitting it to CAPYN.",
  keywords: ["AI agent authorization brief", "agent security design partner", "private architecture brief", "agent governance workshop"]
});

export default function PrivateBoundaryBriefPage() {
  const candidate = process.env.CAPYN_CONTACT_EMAIL?.trim();
  return <BoundaryBriefBuilder contactEmail={isContactEmail(candidate) ? candidate : null} />;
}

