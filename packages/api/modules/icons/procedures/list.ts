import { listRecipeIcons } from "@repo/icons";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";

export const iconSchema = z.object({
	id: z.string(),
	kind: z.enum(["ingredient", "recipe"]),
	key: z.string(),
	status: z.enum(["pending", "ready", "failed"]),
	url: z.string().nullable(),
});

export const listIcons = publicProcedure
	.route({
		method: "GET",
		path: "/icons",
		tags: ["Icons"],
		summary: "Icon status and URLs for a recipe",
	})
	.input(z.object({ recipeId: z.string().uuid() }))
	.output(
		z.object({
			recipe: iconSchema.nullable(),
			ingredients: z.array(iconSchema),
		}),
	)
	.handler(async ({ input }) => {
		const { recipeIcon, ingredientIcons } = await listRecipeIcons(
			input.recipeId,
		);

		return {
			recipe: recipeIcon
				? {
						id: recipeIcon.id,
						kind: recipeIcon.kind,
						key: recipeIcon.key,
						status: recipeIcon.status,
						url: recipeIcon.storageUrl,
					}
				: null,
			ingredients: ingredientIcons.map((icon) => ({
				id: icon.id,
				kind: icon.kind,
				key: icon.key,
				status: icon.status,
				url: icon.storageUrl,
			})),
		};
	});
