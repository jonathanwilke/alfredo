import { auth } from "@repo/auth";
import { db, imports, recipes } from "@repo/database";
import {
	enqueueMissingIngredientIcons,
	listRecipeIcons,
	processIconJobs,
} from "@repo/icons";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";
import { canReadRecipeIcons } from "../../recipes/access";

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
	.handler(async ({ input, context }) => {
		const recipe = await db.query.recipes.findFirst({
			where: eq(recipes.id, input.recipeId),
		});
		const session = await auth.api.getSession({
			headers: context.headers,
		});
		const viewerUserId = session?.user.id ?? null;
		const hasImport = viewerUserId
			? Boolean(
					await db.query.imports.findFirst({
						where: and(
							eq(imports.userId, viewerUserId),
							eq(imports.recipeId, input.recipeId),
						),
					}),
				)
			: false;
		const allowed =
			recipe != null &&
			canReadRecipeIcons({
				isCurated: recipe.isCurated,
				shareToken: recipe.shareToken,
				ownerUserId: recipe.userId,
				viewerUserId,
				hasImport,
			});
		if (!allowed) {
			return { recipe: null, ingredients: [] };
		}

		const queued = await enqueueMissingIngredientIcons(input.recipeId);
		if (queued.length > 0) {
			after(async () => {
				await processIconJobs(queued);
			});
		}

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
