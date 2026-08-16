export const DASHBOARD_SECTIONS = [
  "overview",
  "agents",
  "mandates",
  "authorizations",
  "approvals",
  "audit",
  "developers",
  "settings"
] as const;

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];
