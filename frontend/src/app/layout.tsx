import "@/styles/globals.css";

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
	title: {
		default: "SignalEdge — Real-time Options Intelligence",
		template: "%s | SignalEdge",
	},
	description:
		"Live trading signals and options open-interest analysis for NIFTY, BANKNIFTY, and SENSEX. Real-time multi-timeframe strategy engine for Indian equity indices.",
	keywords: [
		"options trading",
		"open interest",
		"NIFTY signals",
		"BANKNIFTY",
		"trading signals",
		"options intelligence",
		"Indian markets",
		"real-time trading",
		"OI analysis",
	],
	authors: [{ name: "SignalEdge" }],
	creator: "SignalEdge",
	metadataBase: new URL("https://signaledge.app"),
	openGraph: {
		type: "website",
		locale: "en_IN",
		siteName: "SignalEdge",
		title: "SignalEdge — Real-time Options Intelligence",
		description:
			"Live trading signals and options OI analysis for Indian equity indices. Multi-timeframe strategy engine for NIFTY, BANKNIFTY, and SENSEX.",
	},
	twitter: {
		card: "summary",
		title: "SignalEdge — Real-time Options Intelligence",
		description:
			"Live trading signals and options OI analysis for Indian equity indices.",
	},
	robots: {
		index: false,
		follow: false,
	},
	manifest: "/manifest.json",
	icons: {
		icon: [
			{ url: "/icon.svg", type: "image/svg+xml" },
		],
	},
};

export const viewport: Viewport = {
	themeColor: "#0a0a0a",
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	viewportFit: "cover",
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-geist-mono",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`dark ${geist.variable} ${geistMono.variable}`}>
			<body>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
