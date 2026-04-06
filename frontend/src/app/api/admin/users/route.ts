import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function GET() {
	const session = await auth();
	if (!session?.user?.isAdmin) {
		return new Response("Forbidden", { status: 403 });
	}

	const inviter = db
		.select({ id: users.id, name: users.name, email: users.email })
		.from(users)
		.as("inviter");

	const allUsers = await db
		.select({
			id: users.id,
			email: users.email,
			name: users.name,
			image: users.image,
			isAdmin: users.isAdmin,
			createdAt: users.createdAt,
			invitedById: users.invitedById,
			inviterName: inviter.name,
			inviterEmail: inviter.email,
		})
		.from(users)
		.leftJoin(inviter, eq(users.invitedById, inviter.id))
		.orderBy(desc(users.createdAt));

	return Response.json(allUsers);
}
