import { env } from "@/env";

export async function GET() {
	// Hit the backend python API to get the current Kite login URL
	try {
		const res = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL}/kite/login-url`);
		if (!res.ok) {
			throw new Error(`Failed to fetch login URL: ${res.statusText}`);
		}
		const data = await res.json();
		return Response.json({ login_url: data.login_url });
	} catch (error) {
		console.error("Error fetching Kite login URL:", error);
		return new Response("Failed to initialize Kite Login.", { status: 500 });
	}
}
