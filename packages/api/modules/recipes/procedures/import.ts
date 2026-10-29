import { ORPCError } from "@orpc/server";
import { extractedRecipeSchema } from "@repo/ai";
import { QuotaExceededError } from "@repo/payments";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";
import { importRecipeFromUrl } from "../import-recipe";
import { quotaErrors } from "../quota";
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
			"Fetches the page, extracts a recipe, and stores the translation. A new import or translation needs an account. The first one is free; a subscription allows 30 per billing period. Returns QUOTA_EXCEEDED when that limit is used up. A recipe already stored for this language does not count. Icon generation does not count.",
	})
	.input(
		z.object({
			url: z.string().trim().url().max(2000),
			locale: localeSchema,
		}),
	)
	.output(storedRecipeSchema)
	.errors(quotaErrors)
	.handler(async ({ input, context, errors }) => {
		try {
			return await importRecipeFromUrl({
				url: input.url,
				locale: input.locale,
				headers: context.headers,
			});
		} catch (error) {
			if (error instanceof QuotaExceededError) {
				throw errors.QUOTA_EXCEEDED({
					data: {
						used: error.used,
						limit: error.limit,
						plan: error.plan,
					},
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
