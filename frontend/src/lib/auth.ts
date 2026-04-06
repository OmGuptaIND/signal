import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
	.split(",")
	.map((e) => e.trim().toLowerCase())
	.filter(Boolean);

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
		async signIn({ user }) {
			const email = user.email?.toLowerCase() ?? "";
			if (allowedEmails.length === 0) return true;
			return allowedEmails.includes(email);
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
	},
});
