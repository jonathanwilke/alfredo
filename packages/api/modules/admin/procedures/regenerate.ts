import { db, icons } from "@repo/database";
import { regenerateIngredientIcon } from "@repo/icons";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";
import { regenerateAdminIcon } from "../icons";

export const regenerate = adminProcedure
	.route({
		method: "POST",
		path: "/admin/icons/regenerate",
		tags: ["Admin"],
		summary: "Regenerate one ingredient icon",
		description:
			"Overwrites the single ingredient object and bumps its version. Does not debit import quota.",
	})
	.input(z.object({ key: z.string().min(1) }))
	.output(z.object({ key: z.string(), queued: z.literal(true) }))
	.handler(async ({ input, context }) => {
		return regenerateAdminIcon({
			email: context.user.email,
			key: input.key,
			find: async (key) => {
				const row = await db.query.icons.findFirst({
					where: and(
						eq(icons.kind, "ingredient"),
						eq(icons.key, key),
					),
				});
				return row ?? null;
			},
			markPending: async (id) => {
				await db
					.update(icons)
					.set({ status: "pending", updatedAt: new Date() })
					.where(and(eq(icons.id, id), eq(icons.kind, "ingredient")));
			},
			schedule: (key) => {
				after(async () => {
					try {
						await regenerateIngredientIcon({ key });
					} catch (error) {
						console.error(error);
					}
				});
			},
		});
	});
