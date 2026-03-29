import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
	const searchParams = req.nextUrl.searchParams;
	const requestToken = searchParams.get("request_token");

	if (!requestToken) {
		return new Response("Missing request_token from Kite.", { status: 400 });
	}

	// The backend /kite/callback already exchanged the token and started
	// the run before redirecting here.  We just redirect to the dashboard
	// so the frontend picks up the new auth status via its polling.
	return Response.redirect(new URL("/", req.url));
}
