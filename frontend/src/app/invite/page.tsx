"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { env } from "@/env";

function InviteForm() {
	const searchParams = useSearchParams();
	const [code, setCode] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const email = searchParams.get("email") ?? "";
	const name = searchParams.get("name") ?? "";
	const image = searchParams.get("image") ?? "";
	const googleId = searchParams.get("google_id") ?? "";

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const res = await fetch(
				`${env.NEXT_PUBLIC_BACKEND_URL}/api/users/register`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						email,
						name,
						image,
						google_id: googleId,
						invite_code: code.trim(),
					}),
				},
			);

			if (!res.ok) {
				const data = await res.json();
				setError(data.detail ?? "Invalid invite code");
				setLoading(false);
				return;
			}

			// User created — sign in again to complete the flow
			signIn("google", { callbackUrl: "/" });
		} catch {
			setError("Something went wrong. Please try again.");
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
			<div className="w-full max-w-sm rounded-xl border border-border bg-[#111111] p-8">
				<div className="mb-6 text-center">
					<h1 className="mb-2 font-semibold text-xl text-white tracking-tight">
						Enter Invite Code
					</h1>
					<p className="text-[13px] text-muted-foreground">
						You need an invite code to join.
					</p>
					{email && (
						<p className="mt-1 text-[12px] text-muted-foreground/60">
							Signing up as {email}
						</p>
					)}
				</div>

				<form onSubmit={handleSubmit}>
					<input
						type="text"
						value={code}
						onChange={(e) => setCode(e.target.value)}
						placeholder="Paste your invite code"
						className="mb-4 w-full rounded-lg border border-border bg-[#0a0a0a] px-4 py-2.5 font-mono text-[14px] text-white placeholder:text-muted-foreground/40 focus:border-white/20 focus:outline-none"
						autoFocus
					/>

					{error && (
						<p className="mb-4 text-[13px] text-red-400">{error}</p>
					)}

					<button
						type="submit"
						disabled={loading || !code.trim()}
						className="w-full rounded-lg bg-white px-4 py-2.5 font-medium text-[14px] text-black transition-colors hover:bg-white/90 disabled:opacity-50"
					>
						{loading ? "Verifying..." : "Join"}
					</button>
				</form>

				<button
					type="button"
					onClick={() => (window.location.href = "/login")}
					className="mt-4 w-full text-center text-[12px] text-muted-foreground/60 hover:text-muted-foreground"
				>
					Back to login
				</button>
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
