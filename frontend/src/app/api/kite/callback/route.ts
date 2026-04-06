import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
	const requestToken = req.nextUrl.searchParams.get("request_token");
	const status = req.nextUrl.searchParams.get("status");

	if (status !== "success" || !requestToken) {
		const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
		return Response.redirect(
			`${baseUrl}/?error=kite_auth_failed`,
		);
	}

	const apiKey = process.env.KITE_API_KEY ?? "";
	const apiSecret = process.env.KITE_API_SECRET ?? "";

	const checksum = createHash("sha256")
		.update(apiKey + requestToken + apiSecret)
		.digest("hex");

	try {
		const res = await fetch("https://api.kite.trade/session/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				api_key: apiKey,
				request_token: requestToken,
				checksum,
			}),
		});

		if (!res.ok) {
			const text = await res.text();
			console.error("Kite token exchange failed:", text);
			const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
			return Response.redirect(
				`${baseUrl}/?error=token_exchange_failed`,
			);
		}

		const json = await res.json();
		const accessToken = json.data?.access_token;

		if (!accessToken) {
			const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
			return Response.redirect(
				`${baseUrl}/?error=no_access_token`,
			);
		}

		const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
		return Response.redirect(
			`${baseUrl}/?token=${encodeURIComponent(accessToken)}`,
		);
	} catch (err) {
		console.error("Kite token exchange error:", err);
		const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
		return Response.redirect(
			`${baseUrl}/?error=exchange_error`,
		);
	}
}
