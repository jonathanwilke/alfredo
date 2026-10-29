import { db, icons } from "@repo/database";
import { and, asc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";
import { listAdminIcons } from "../icons";

async function queryIngredientIcons(term: string) {
	const where = term
		? and(eq(icons.kind, "ingredient"), ilike(icons.key, `%${term}%`))
		: eq(icons.kind, "ingredient");

	return db
		.select()
		.from(icons)
		.where(where)
		.orderBy(asc(icons.key))
		.limit(200);
}

export const list = adminProcedure
	.route({
		method: "GET",
		path: "/admin/icons",
		tags: ["Admin"],
		summary: "List ingredient icons",
	})
	.input(z.object({ search: z.string().optional().default("") }))
	.output(
		z.object({
			icons: z.array(
				z.object({
					id: z.string(),
					key: z.string(),
					status: z.enum(["pending", "ready", "failed"]),
					version: z.number().int(),
					url: z.string().nullable(),
					updatedAt: z.string(),
				}),
			),
		}),
	)
	.handler(async ({ input, context }) => {
		return listAdminIcons({
			email: context.user.email,
			search: input.search,
			load: (term) => queryIngredientIcons(term),
		});
	});
