import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const INTERNAL_KEY = process.env.BACKEND_INTERNAL_KEY ?? "";

// These paths are part of the auth flow — no session required
const PUBLIC_PATHS = ["users/check", "users/register"];

type Params = { path: string[] };

async function handler(
	request: NextRequest,
	{ params }: { params: Promise<Params> },
) {
	const { path } = await params;
	const pathStr = path.join("/");

	// Session check — skip for public auth-flow endpoints
	const isPublic = PUBLIC_PATHS.some((p) => pathStr.startsWith(p));
	if (!isPublic) {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
		}
	}

	// Build target URL, forwarding query params
	const targetUrl = new URL(`${BACKEND_URL}/api/${pathStr}`);
	request.nextUrl.searchParams.forEach((value, key) => {
		targetUrl.searchParams.set(key, value);
	});

	// Forward headers (strip host)
	const forwardHeaders: Record<string, string> = {
		"X-Internal-Key": INTERNAL_KEY,
	};
	const contentType = request.headers.get("content-type");
	if (contentType) forwardHeaders["content-type"] = contentType;

	const body =
		request.method !== "GET" && request.method !== "HEAD"
			? await request.text()
			: undefined;

	const upstream = await fetch(targetUrl.toString(), {
		method: request.method,
		headers: forwardHeaders,
		body,
	});

	// Stream SSE responses directly
	const upstreamContentType = upstream.headers.get("content-type") ?? "";
	if (upstreamContentType.includes("text/event-stream")) {
		return new Response(upstream.body, {
			status: upstream.status,
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
				"X-Accel-Buffering": "no",
			},
		});
	}

	const data = await upstream.text();
	return new Response(data, {
		status: upstream.status,
		headers: {
			"Content-Type": upstreamContentType || "application/json",
		},
	});
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
