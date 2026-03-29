import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Join SignalEdge",
	description: "Enter your invite code to join SignalEdge. Real-time options intelligence for Indian equity markets.",
	openGraph: {
		title: "Join SignalEdge",
		description: "Get access to live trading signals for NIFTY, BANKNIFTY, and SENSEX options.",
	},
};

export default function InviteLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
