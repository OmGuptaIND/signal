import { createHmac } from "crypto";
import { auth } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const INTERNAL_KEY = process.env.BACKEND_INTERNAL_KEY ?? "";

/** 60-second HMAC-SHA256 token for direct SSE connection to the backend. */
export async function GET() {
	const session = await auth();
	if (!session?.user?.email) {
		return Response.json({ detail: "Unauthorized" }, { status: 401 });
	}

	const payload = Buffer.from(
		JSON.stringify({
			email: session.user.email,
			exp: Math.floor(Date.now() / 1000) + 60,
		}),
	).toString("base64url");

	const sig = createHmac("sha256", INTERNAL_KEY)
		.update(payload)
		.digest("base64url");

	return Response.json({
		token: `${payload}.${sig}`,
		streamUrl: `${BACKEND_URL}/api/signals/stream`,
	});
}
