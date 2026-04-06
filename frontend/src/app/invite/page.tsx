"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Zap } from "lucide-react";

function InviteForm() {
	const searchParams = useSearchParams();
	const email = searchParams.get("email") ?? "";
	const name = searchParams.get("name") ?? "";
	const image = searchParams.get("image") ?? "";
	const googleId = searchParams.get("google_id") ?? "";

	const [code, setCode] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const res = await fetch("/api/invite/redeem", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					code: code.trim(),
					email,
					name,
					image,
					google_id: googleId,
				}),
			});

			if (!res.ok) {
				const data = await res.json();
				setError(data.error ?? "Invalid invite code");
				setLoading(false);
				return;
			}

			// User created — sign them in
			signIn("google", { callbackUrl: "/" });
		} catch {
			setError("Something went wrong. Please try again.");
			setLoading(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4 text-[#ededed]">
			<div className="w-full max-w-sm space-y-6">
				<div className="flex flex-col items-center text-center">
					<div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[#ededed] text-[#0a0a0a]">
						<Zap className="size-6" />
					</div>
					<h1 className="text-2xl font-bold tracking-tight">Monies</h1>
					<p className="mt-1 text-sm text-[#888]">
						You need an invite code to join
					</p>
				</div>

				<div className="rounded-lg border border-white/10 bg-[#111] p-6 space-y-4">
					<div className="text-center">
						<h2 className="text-lg font-semibold">Enter Invite Code</h2>
						{email && (
							<p className="mt-1 text-sm text-[#888]">
								Signing up as {email}
							</p>
						)}
					</div>

					{error && (
						<div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
							{error}
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-3">
						<input
							type="text"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="Paste your invite code"
							className="w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-2.5 text-sm text-[#ededed] placeholder-[#555] outline-none focus:border-white/20"
							autoFocus
						/>
						<button
							type="submit"
							disabled={!code.trim() || loading}
							className="flex w-full items-center justify-center rounded-lg bg-[#ededed] px-4 py-2.5 text-sm font-medium text-[#0a0a0a] transition-colors hover:bg-white disabled:opacity-50"
						>
							{loading ? "Verifying..." : "Join Monies"}
						</button>
					</form>
				</div>

				<p className="text-center text-xs text-[#555]">
					Ask an existing member for an invite code
				</p>
			</div>
		</div>
	);
}

export default function InvitePage() {
	return (
		<Suspense>
			<InviteForm />
		</Suspense>
	);
}
