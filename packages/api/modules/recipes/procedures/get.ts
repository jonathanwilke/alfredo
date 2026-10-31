import { extractedRecipeSchema } from "@repo/ai";
import { auth } from "@repo/auth";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";
import { loadRecipe } from "../import-recipe";

const localeSchema = z.enum(["de", "en"]);

export const getRecipe = publicProcedure
	.route({
		method: "GET",
		path: "/recipes/{recipeId}",
		tags: ["Recipes"],
		summary: "Stored recipe translation",
	})
	.input(
		z.object({
			recipeId: z.string().uuid(),
			locale: localeSchema,
		}),
	)
	.output(
		z
			.object({
				recipeId: z.string().uuid(),
				sourceUrl: z.string().min(1),
				content: extractedRecipeSchema,
				isCurated: z.boolean(),
				servedLocale: z.string(),
				isOwner: z.boolean(),
				shared: z.boolean(),
				attributionUrl: z.string().nullable(),
			})
			.nullable(),
	)
	.handler(async ({ input, context }) => {
		const session = await auth.api.getSession({
			headers: context.headers,
		});
		const recipe = await loadRecipe({
			...input,
			viewerUserId: session?.user.id ?? null,
		});
		if (!recipe) {
			return null;
		}
		return {
			...recipe,
			isOwner: recipe.isOwner ?? false,
			shared: recipe.shared ?? false,
		};
	});
