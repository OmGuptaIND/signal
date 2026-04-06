import "@/styles/globals.css";

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
	title: "Monies",
	description: "Google Auth → Kite Connect → Token",
	robots: { index: false, follow: false },
};

export const viewport: Viewport = {
	themeColor: "#0a0a0a",
	width: "device-width",
	initialScale: 1,
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
				<SessionProvider>{children}</SessionProvider>
			</body>
		</html>
	);
}
