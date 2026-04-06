export { auth as middleware } from "@/lib/auth";

export const config = {
	matcher: [
		"/((?!login|invite|api/auth|api/invite|api/kite|_next/static|_next/image|favicon.ico|icon.svg).*)",
	],
};
