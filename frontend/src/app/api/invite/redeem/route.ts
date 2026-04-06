import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { inviteCodes, users } from "@/lib/db/schema";

export async function POST(req: Request) {
	const body = await req.json();
	const { code, email, name, image, google_id } = body as {
		code: string;
		email: string;
		name?: string;
		image?: string;
		google_id?: string;
	};

	if (!code || !email) {
		return Response.json({ error: "Missing code or email" }, { status: 400 });
	}

	// Find unused invite code
	const invite = await db
		.select()
		.from(inviteCodes)
		.where(and(eq(inviteCodes.code, code.trim()), isNull(inviteCodes.usedById)))
		.limit(1);

	if (invite.length === 0) {
		return Response.json(
			{ error: "Invalid or already used invite code" },
			{ status: 400 },
		);
	}

	// Check if user already exists
	const existing = await db
		.select()
		.from(users)
		.where(eq(users.email, email.toLowerCase()))
		.limit(1);

	if (existing.length > 0) {
		return Response.json({ error: "User already exists" }, { status: 400 });
	}

	// Create user
	const newUser = await db
		.insert(users)
		.values({
			email: email.toLowerCase(),
			name: name ?? null,
			image: image ?? null,
			googleId: google_id ?? null,
			isAdmin: false,
			invitedById: invite[0]!.createdById,
		})
		.returning({ id: users.id });

	// Mark invite code as used
	await db
		.update(inviteCodes)
		.set({ usedById: newUser[0]!.id, usedAt: new Date() })
		.where(eq(inviteCodes.id, invite[0]!.id));

	return Response.json({ success: true });
}
