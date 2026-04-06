import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inviteCodes, users } from "@/lib/db/schema";

export async function GET() {
	const session = await auth();
	if (!session?.user?.isAdmin) {
		return new Response("Forbidden", { status: 403 });
	}

	const creator = db
		.select({ id: users.id, name: users.name, email: users.email })
		.from(users)
		.as("creator");

	const redeemer = db
		.select({ id: users.id, name: users.name, email: users.email })
		.from(users)
		.as("redeemer");

	const codes = await db
		.select({
			id: inviteCodes.id,
			code: inviteCodes.code,
			createdAt: inviteCodes.createdAt,
			usedAt: inviteCodes.usedAt,
			creatorName: creator.name,
			creatorEmail: creator.email,
			redeemerName: redeemer.name,
			redeemerEmail: redeemer.email,
		})
		.from(inviteCodes)
		.leftJoin(creator, eq(inviteCodes.createdById, creator.id))
		.leftJoin(redeemer, eq(inviteCodes.usedById, redeemer.id))
		.orderBy(desc(inviteCodes.createdAt));

	return Response.json(codes);
}
