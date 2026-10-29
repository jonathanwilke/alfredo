import { ORPCError } from "@orpc/server";
import { extractedRecipeSchema } from "@repo/ai";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";
import { importRecipeFromUrl } from "../import-recipe";
import { ImportError } from "../source";

const localeSchema = z.enum(["de", "en"]);

const storedRecipeSchema = z.object({
	recipeId: z.string().uuid(),
	sourceUrl: z.string().url(),
	content: extractedRecipeSchema,
});

export const importRecipe = publicProcedure
	.route({
		method: "POST",
		path: "/recipes/import",
		tags: ["Recipes"],
		summary: "Import a recipe URL into the chosen language",
		description:
			"Fetches the page, extracts a recipe, and stores the translation. Icon generation is queued after the response and does not count as an import.",
	})
	.input(
		z.object({
			url: z.string().trim().url().max(2000),
			locale: localeSchema,
		}),
	)
	.output(storedRecipeSchema)
	.handler(async ({ input, context }) => {
		try {
			return await importRecipeFromUrl({
				url: input.url,
				locale: input.locale,
				headers: context.headers,
			});
		} catch (error) {
			if (error instanceof ImportError) {
				throw new ORPCError("BAD_REQUEST", { message: error.reason });
			}
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "extract_failed",
			});
		}
	});
