import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
	providers: [
		Google({
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		}),
	],
	session: { strategy: "jwt" },
	pages: {
		signIn: "/login",
	},
	callbacks: {
		async signIn({ user, profile }) {
			const backendUrl =
				process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
			const internalKey = process.env.BACKEND_INTERNAL_KEY ?? "";

			try {
				const res = await fetch(`${backendUrl}/api/users/check`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Internal-Key": internalKey,
					},
					body: JSON.stringify({ email: user.email }),
				});

				if (!res.ok) return false;

				const data = await res.json();

				if (data.exists) {
					return true;
				}

				// New user — redirect to invite page
				const params = new URLSearchParams({
					email: user.email ?? "",
					name: user.name ?? "",
					image: user.image ?? "",
					google_id: profile?.sub ?? "",
				});
				return `/invite?${params.toString()}`;
			} catch (err) {
				console.error("Error checking user:", err);
				// Backend unreachable — redirect to login with error instead of blocking
				return "/login?error=BackendUnavailable";
			}
		},
		async jwt({ token, user }) {
			if (user) {
				token.email = user.email;
				token.name = user.name;
				token.picture = user.image;
			}
			return token;
		},
		async session({ session, token }) {
			if (session.user) {
				session.user.email = token.email as string;
				session.user.name = token.name as string;
				session.user.image = token.picture as string;
			}
			return session;
		},
		authorized({ auth, request }) {
			const { pathname } = request.nextUrl;
			const isPublic =
				pathname.startsWith("/login") || pathname.startsWith("/invite");
			const isAuthApi = pathname.startsWith("/api/auth");
			if (isPublic || isAuthApi) return true;
			return !!auth?.user;
		},
	},
});
