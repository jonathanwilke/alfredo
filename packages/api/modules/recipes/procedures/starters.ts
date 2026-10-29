import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";
import { listStarterRecipes } from "../starters";

const localeSchema = z.enum(["de", "en"]);

export const starters = publicProcedure
	.route({
		method: "GET",
		path: "/recipes/starters",
		tags: ["Recipes"],
		summary: "Free curated starter recipes",
		description:
			"Operator-curated dishes. Opening them does not spend a credit.",
	})
	.input(z.object({ locale: localeSchema }))
	.output(
		z.array(
			z.object({
				recipeId: z.string().uuid(),
				title: z.string(),
				servedLocale: z.string(),
			}),
		),
	)
	.handler(async ({ input }) => listStarterRecipes(input.locale));
