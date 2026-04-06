"use client";

import { signOut, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, LogOut, Settings, Zap } from "lucide-react";

function Home() {
	const { data: session } = useSession();
	const searchParams = useSearchParams();
	const tokenFromUrl = searchParams.get("token");
	const error = searchParams.get("error");

	const [token, setToken] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [connecting, setConnecting] = useState(false);

	useEffect(() => {
		if (tokenFromUrl) {
			setToken(tokenFromUrl);
			// Clean URL without reload
			window.history.replaceState({}, "", "/");
		}
	}, [tokenFromUrl]);

	const handleConnect = useCallback(async () => {
		setConnecting(true);
		try {
			const res = await fetch("/api/kite/login");
			const data = await res.json();
			if (data.login_url) {
				window.location.href = data.login_url;
			}
		} catch {
			setConnecting(false);
		}
	}, []);

	const handleCopy = useCallback(async () => {
		if (!token) return;
		await navigator.clipboard.writeText(token);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [token]);

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] p-4 text-[#ededed]">
			<div className="w-full max-w-md space-y-6">
				{/* Header */}
				<div className="flex flex-col items-center text-center">
					<div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[#ededed] text-[#0a0a0a]">
						<Zap className="size-6" />
					</div>
					<h1 className="text-2xl font-bold tracking-tight">Monies</h1>
					<p className="mt-1 text-sm text-[#888]">
						Connect Kite to get your access token
					</p>
				</div>

				{/* Error */}
				{error && (
					<div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
						{error === "kite_auth_failed" && "Kite authentication was cancelled or failed."}
						{error === "token_exchange_failed" && "Failed to exchange token with Kite. Try again."}
						{error === "no_access_token" && "No access token received from Kite."}
						{error === "exchange_error" && "Something went wrong during token exchange."}
						{!["kite_auth_failed", "token_exchange_failed", "no_access_token", "exchange_error"].includes(error) && "An error occurred."}
					</div>
				)}

				{/* Token Display */}
				{token ? (
					<div className="space-y-3">
						<div className="rounded-lg border border-white/10 bg-[#111] p-4">
							<div className="mb-2 flex items-center justify-between">
								<span className="text-xs font-medium uppercase tracking-wider text-[#888]">
									Access Token
								</span>
								<span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
									Connected
								</span>
							</div>
							<code className="block break-all rounded bg-[#1a1a1a] p-3 font-mono text-sm text-[#ededed]">
								{token}
							</code>
						</div>
						<button
							type="button"
							onClick={handleCopy}
							className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ededed] px-4 py-2.5 text-sm font-medium text-[#0a0a0a] transition-colors hover:bg-white"
						>
							{copied ? (
								<>
									<Check className="size-4" />
									Copied!
								</>
							) : (
								<>
									<Copy className="size-4" />
									Copy Token
								</>
							)}
						</button>
						<button
							type="button"
							onClick={handleConnect}
							className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-[#888] transition-colors hover:border-white/20 hover:text-[#ededed]"
						>
							<ExternalLink className="size-4" />
							Reconnect Kite
						</button>
					</div>
				) : (
					<button
						type="button"
						onClick={handleConnect}
						disabled={connecting}
						className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ededed] px-4 py-3 text-sm font-medium text-[#0a0a0a] transition-colors hover:bg-white disabled:opacity-50"
					>
						{connecting ? (
							"Redirecting to Kite..."
						) : (
							<>
								<ExternalLink className="size-4" />
								Connect Kite
							</>
						)}
					</button>
				)}

				{/* Footer links */}
				<div className="flex items-center justify-center gap-4 pt-2">
					{session?.user?.isAdmin && (
						<Link
							href="/admin"
							className="flex items-center gap-1.5 text-xs text-[#555] transition-colors hover:text-[#888]"
						>
							<Settings className="size-3" />
							Admin
						</Link>
					)}
					<button
						type="button"
						onClick={() => signOut({ callbackUrl: "/login" })}
						className="flex items-center gap-1.5 text-xs text-[#555] transition-colors hover:text-[#888]"
					>
						<LogOut className="size-3" />
						Sign out
					</button>
				</div>
			</div>
		</div>
	);
}

export default function HomePage() {
	return (
		<Suspense>
			<Home />
		</Suspense>
	);
}
