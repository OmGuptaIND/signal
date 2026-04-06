import { nanoid } from "nanoid";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inviteCodes } from "@/lib/db/schema";

export async function POST() {
	const session = await auth();
	if (!session?.user?.id) {
		return new Response("Unauthorized", { status: 401 });
	}

	const code = nanoid(8);

	await db.insert(inviteCodes).values({
		code,
		createdById: session.user.id,
	});

	return Response.json({ code });
}
