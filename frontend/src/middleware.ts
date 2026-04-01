export { auth as middleware } from "@/lib/auth";

export const config = {
	matcher: [
		"/((?!login|invite|api/auth|api/proxy/users|_next/static|_next/image|favicon.ico).*)",
	],
};
