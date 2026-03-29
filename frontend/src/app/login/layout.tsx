import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Sign In",
	description: "Sign in to SignalEdge to access your live trading signals dashboard. Real-time options intelligence for Indian markets.",
	openGraph: {
		title: "Sign In | SignalEdge",
		description: "Access your live trading signals dashboard for NIFTY, BANKNIFTY, and SENSEX options.",
	},
};

export default function LoginLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
