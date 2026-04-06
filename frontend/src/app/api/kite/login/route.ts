import { auth } from "@/lib/auth";

export async function GET() {
	const session = await auth();
	if (!session?.user) {
		return new Response("Unauthorized", { status: 401 });
	}

	const apiKey = process.env.KITE_API_KEY;
	if (!apiKey) {
		return Response.json(
			{ error: "KITE_API_KEY not configured" },
			{ status: 500 },
		);
	}

	const redirectUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/kite/callback`;
	const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${apiKey}&redirect_url=${encodeURIComponent(redirectUrl)}`;

	return Response.json({ login_url: loginUrl });
}
