import type { Metadata } from "next";
import "@fontsource-variable/geologica";
import "@fontsource-variable/manrope";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010"),
  title: {
    default: "CAPYN — Authority infrastructure for autonomous agents",
    template: "%s · CAPYN"
  },
  description:
    "Delegate spending and operational capabilities to AI agents with enforceable policies, limits, approvals and audit trails.",
  applicationName: "CAPYN",
  keywords: ["agent authorization", "AI agent security", "agent payments", "policy engine", "programmable authority"],
  authors: [{ name: "Matthew Wicks", url: "https://github.com/meanstackofdoom" }],
  creator: "CAPYN",
  publisher: "CAPYN",
  category: "Security software",
  referrer: "origin-when-cross-origin",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: "CAPYN — Authority infrastructure for autonomous agents",
    description: "Give agents authority. Not unlimited access.",
    siteName: "CAPYN"
  },
  twitter: {
    card: "summary_large_image",
    title: "CAPYN — Authority infrastructure for autonomous agents",
    description: "Give agents authority. Not unlimited access."
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
