import type { Metadata } from "next";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s | SignalEdge",
  },
  description:
    "Monitor your active trading strategies and real-time options signals for NIFTY, BANKNIFTY, and SENSEX.",
  openGraph: {
    title: "Dashboard | SignalEdge",
    description:
      "Live trading signals dashboard. Monitor strategies, view charts, and track options open-interest in real-time.",
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
