"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ERROR_MESSAGES: Record<string, string> = {
	BackendUnavailable: "Backend server is unavailable. Please try again later.",
	AccessDenied: "Access denied. You may not have an account yet.",
};

function LoginForm() {
	const searchParams = useSearchParams();
	const errorKey = searchParams.get("error") ?? "";
	const errorMessage = ERROR_MESSAGES[errorKey] ?? (errorKey ? "An error occurred. Please try again." : "");

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<div className="w-full max-w-sm space-y-6">
				{/* Brand */}
				<div className="flex flex-col items-center text-center">
					<div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-4">
						<Zap className="size-6" />
					</div>
					<h1 className="text-2xl font-bold tracking-tight">SignalEdge</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Real-time options intelligence for Indian markets
					</p>
				</div>

				<Card>
					<CardHeader className="text-center pb-4">
						<CardTitle className="text-lg">Welcome back</CardTitle>
						<CardDescription>
							Sign in to access your trading dashboard
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{errorMessage && (
							<div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
								{errorMessage}
							</div>
						)}

						<Button
							className="w-full gap-3"
							variant="outline"
							size="lg"
							onClick={() => signIn("google", { callbackUrl: "/" })}
						>
							<svg className="h-5 w-5" viewBox="0 0 24 24">
								<title>Google</title>
								<path
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
									fill="#4285F4"
								/>
								<path
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									fill="#34A853"
								/>
								<path
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									fill="#FBBC05"
								/>
								<path
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									fill="#EA4335"
								/>
							</svg>
							Sign in with Google
						</Button>
					</CardContent>
				</Card>

				<p className="text-center text-xs text-muted-foreground">
					Access is invite-only. Need an invite?{" "}
					<a href="#" className="text-foreground underline-offset-4 hover:underline">
						Request access
					</a>
				</p>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense>
			<LoginForm />
		</Suspense>
	);
}
