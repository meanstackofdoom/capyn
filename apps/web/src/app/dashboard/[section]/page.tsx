import { notFound } from "next/navigation";
import { ControlPlane } from "@/components/control-plane";
import { DASHBOARD_SECTIONS, type DashboardSection } from "@/lib/dashboard";

export function generateStaticParams() {
  return DASHBOARD_SECTIONS.filter((section) => section !== "overview").map((section) => ({ section }));
}

export default async function DashboardSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!DASHBOARD_SECTIONS.includes(section as DashboardSection) || section === "overview") notFound();
  return <ControlPlane section={section as DashboardSection} />;
}
