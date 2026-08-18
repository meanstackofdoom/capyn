import type { Metadata } from "next";
import { ProofViewer } from "@/components/public/proof-viewer";
import { createPageMetadata } from "@/lib/metadata";

const pageMetadata = createPageMetadata({
  title: "Decision Proof Viewer",
  path: "/proof",
  description: "Replay and locally verify a synthetic CAPYN authority receipt from a client-side evidence bundle.",
  keywords: ["AI agent decision receipt", "authorization evidence", "agent policy audit", "SHA-256 evidence viewer"]
});

export const metadata: Metadata = {
  ...pageMetadata,
  robots: { index: false, follow: true }
};

export default function ProofPage() {
  return <ProofViewer />;
}
