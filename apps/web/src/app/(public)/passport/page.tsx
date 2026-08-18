import { AuthorityPassportViewer } from "@/components/public/authority-passport-viewer";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Verifiable Authority Passport",
  path: "/passport",
  description: "Share and locally verify a browser-local CAPYN mandate draft without activating policy or uploading the passport payload.",
  keywords: ["AI agent authority passport", "verifiable agent permissions", "agent mandate", "AI agent authorization"]
});

export default function AuthorityPassportPage() {
  return <AuthorityPassportViewer />;
}
