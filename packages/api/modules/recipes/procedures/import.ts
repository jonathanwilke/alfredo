import { ORPCError } from "@orpc/server";
import { extractedRecipeSchema } from "@repo/ai";
import { InsufficientCreditsError } from "@repo/payments";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";
import { creditErrors } from "../credits";
import { importRecipeFromUrl } from "../import-recipe";
import { ImportError } from "../source";

const localeSchema = z.enum(["de", "en"]);

const storedRecipeSchema = z.object({
	recipeId: z.string().uuid(),
	sourceUrl: z.string().url(),
	content: extractedRecipeSchema,
	isCurated: z.boolean(),
	servedLocale: z.string(),
});

export const importRecipe = publicProcedure
	.route({
		method: "POST",
		path: "/recipes/import",
		tags: ["Recipes"],
		summary: "Import a recipe URL into the chosen language",
		description:
			"Fetches the page, extracts a recipe, and stores the translation. A new import or translation needs an account and one credit. New accounts start with 3 welcome credits. Returns INSUFFICIENT_CREDITS when the balance is too low. A recipe already stored for this language does not cost a credit. Curated recipes are free, including a pasted source URL. Icon generation does not cost a credit.",
	})
	.input(
		z.object({
			url: z.string().trim().url().max(2000),
			locale: localeSchema,
		}),
	)
	.output(storedRecipeSchema)
	.errors(creditErrors)
	.handler(async ({ input, context, errors }) => {
		try {
			return await importRecipeFromUrl({
				url: input.url,
				locale: input.locale,
				headers: context.headers,
			});
		} catch (error) {
			if (error instanceof InsufficientCreditsError) {
				throw errors.INSUFFICIENT_CREDITS({
					data: { balance: error.balance },
				});
			}
			if (error instanceof ImportError) {
				if (error.reason === "account_required") {
					throw new ORPCError("UNAUTHORIZED");
				}
				throw new ORPCError("BAD_REQUEST", { message: error.reason });
			}
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "extract_failed",
			});
		}
	});
