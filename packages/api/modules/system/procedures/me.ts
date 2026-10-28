import { auth } from "@repo/auth";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";

const userSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
});

export const me = publicProcedure
	.route({
		method: "GET",
		path: "/me",
		tags: ["System"],
		summary: "Current user",
		description:
			"Returns the signed-in user, or null when there is no session.",
	})
	.output(
		z.object({
			user: userSchema.nullable(),
		}),
	)
	.handler(async ({ context }) => {
		const session = await auth.api.getSession({
			headers: context.headers,
		});

		if (!session) {
			return { user: null };
		}

		return {
			user: {
				id: session.user.id,
				name: session.user.name,
				email: session.user.email,
				image: session.user.image ?? null,
			},
		};
	});
