"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
			const res = await fetch("/api/proxy/users/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email,
					name,
					image,
					google_id: googleId,
					invite_code: code.trim(),
				}),
			});

			if (!res.ok) {
				const data = await res.json();
				setError(data.detail ?? "Invalid invite code");
				setLoading(false);
				return;
			}

			signIn("google", { callbackUrl: "/" });
		} catch {
			setError("Something went wrong. Please try again.");
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<div className="w-full max-w-sm space-y-6">
				{/* Brand */}
				<div className="flex flex-col items-center text-center">
					<div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-4">
						<Zap className="size-6" />
					</div>
					<h1 className="text-2xl font-bold tracking-tight">SignalEdge</h1>
				</div>

				<Card>
					<CardHeader className="text-center pb-4">
						<CardTitle className="text-lg">Enter Invite Code</CardTitle>
						<CardDescription>
							You need an invite code to join SignalEdge.
							{email && (
								<span className="block mt-1 text-xs">
									Signing up as {email}
								</span>
							)}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="invite-code">Invite Code</Label>
								<Input
									id="invite-code"
									type="text"
									value={code}
									onChange={(e) => setCode(e.target.value)}
									placeholder="Paste your invite code"
									className="font-mono"
									autoFocus
								/>
							</div>

							{error && (
								<div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
									{error}
								</div>
							)}

							<Button
								type="submit"
								className="w-full"
								disabled={loading || !code.trim()}
							>
								{loading ? "Verifying..." : "Join SignalEdge"}
							</Button>
						</form>
					</CardContent>
				</Card>

				<div className="text-center">
					<Button
						variant="ghost"
						size="sm"
						className="gap-1.5 text-muted-foreground"
						onClick={() => (window.location.href = "/login")}
					>
						<ArrowLeft className="size-3.5" />
						Back to login
					</Button>
				</div>
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
