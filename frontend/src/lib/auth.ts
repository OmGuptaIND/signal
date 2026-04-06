import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

declare module "next-auth" {
	interface Session {
		user: {
			id: number;
			email: string;
			name: string;
			image: string;
			isAdmin: boolean;
		};
	}
}

declare module "@auth/core/jwt" {
	interface JWT {
		userId?: number;
		isAdmin?: boolean;
	}
}

// Lazy-load DB to avoid importing pg in Edge Runtime (middleware)
async function getDb() {
	const { db } = await import("./db");
	const { users } = await import("./db/schema");
	const { eq } = await import("drizzle-orm");
	return { db, users, eq };
}

const adminEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();

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
			const email = user.email?.toLowerCase() ?? "";
			if (!email) return false;

			const { db, users, eq } = await getDb();

			// Check if user exists in DB
			const existing = await db
				.select()
				.from(users)
				.where(eq(users.email, email))
				.limit(1);

			if (existing.length > 0) return true;

			// Auto-create admin user on first sign-in
			if (adminEmail && email === adminEmail) {
				await db.insert(users).values({
					email,
					name: user.name ?? null,
					image: user.image ?? null,
					googleId: profile?.sub ?? null,
					isAdmin: true,
				});
				return true;
			}

			// Not in DB — redirect to invite page
			const params = new URLSearchParams({
				email,
				name: user.name ?? "",
				image: user.image ?? "",
				google_id: profile?.sub ?? "",
			});
			return `/invite?${params.toString()}`;
		},
		async jwt({ token, user, trigger }) {
			if (user || trigger === "signIn") {
				const email = (token.email ?? "").toLowerCase();
				const { db, users, eq } = await getDb();

				const dbUser = await db
					.select({ id: users.id, isAdmin: users.isAdmin })
					.from(users)
					.where(eq(users.email, email))
					.limit(1);

				if (dbUser.length > 0) {
					token.userId = dbUser[0]!.id;
					token.isAdmin = dbUser[0]!.isAdmin;
				}
			}
			return token;
		},
		async session({ session, token }) {
			if (session.user) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const u = session.user as any;
				u.id = token.userId;
				u.isAdmin = token.isAdmin;
			}
			return session;
		},
	},
});
