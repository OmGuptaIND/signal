import "@/styles/globals.css";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
	title: "Strategy Engine — Live Terminal",
	description: "Real-time order intelligence and trading signals dashboard",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
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
