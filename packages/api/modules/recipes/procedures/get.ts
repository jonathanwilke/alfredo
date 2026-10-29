import { extractedRecipeSchema } from "@repo/ai";
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
				sourceUrl: z.string().url(),
				content: extractedRecipeSchema,
				isCurated: z.boolean(),
				servedLocale: z.string(),
			})
			.nullable(),
	)
	.handler(async ({ input }) => {
		return await loadRecipe(input);
	});
