import { enqueueRecipeIcons, processIconJobs } from "@repo/icons";
import { after } from "next/server";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";

export const scheduleIcons = publicProcedure
	.route({
		method: "POST",
		path: "/icons/schedule",
		tags: ["Icons"],
		summary: "Queue icon generation after a recipe import",
		description:
			"Inserts pending icon rows and returns immediately. Image generation runs after the response and does not count as an import. Dish photos are prompted from the recipe stored for recipeId. ingredientKeys only queue ingredient icons.",
	})
	.input(
		z.object({
			recipeId: z.string().uuid(),
			title: z.string().min(1),
			ingredientKeys: z.array(z.string().min(1)).max(80),
		}),
	)
	.output(z.object({ queued: z.number() }))
	.handler(async ({ input }) => {
		const ids = await enqueueRecipeIcons(input);

		if (ids.length > 0) {
			after(async () => {
				await processIconJobs(ids);
			});
		}

		return { queued: ids.length };
	});
