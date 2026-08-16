import type { Metadata } from "next";
import { ControlPlane } from "@/components/control-plane";

export const metadata: Metadata = { title: "Overview" };

export default function DashboardPage() {
  return <ControlPlane section="overview" />;
}
