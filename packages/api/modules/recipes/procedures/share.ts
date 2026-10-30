import { ORPCError } from "@orpc/server";
import { extractedRecipeSchema } from "@repo/ai";
import { db, recipes } from "@repo/database";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, publicProcedure } from "../../../orpc/procedures";
import {
	createShareToken,
	publicRecipePath,
	sharedRecipePath,
} from "../access";
import { loadSharedRecipe, viewerOwnsRecipe } from "../import-recipe";

const localeSchema = z.enum(["de", "en"]);

const shareResult = z.object({
	shared: z.boolean(),
	path: z.string().nullable(),
});

async function ownedRecipe(userId: string, recipeId: string) {
	const recipe = await db.query.recipes.findFirst({
		where: eq(recipes.id, recipeId),
	});
	if (!recipe) {
		throw new ORPCError("NOT_FOUND");
	}
	if (!(await viewerOwnsRecipe(userId, recipe))) {
		throw new ORPCError("FORBIDDEN");
	}
	return recipe;
}

export const readSharedRecipe = publicProcedure
	.route({
		method: "GET",
		path: "/share/{token}",
		tags: ["Recipes"],
		summary: "Read a recipe from its unguessable share link",
	})
	.input(z.object({ token: z.string().min(1).max(80), locale: localeSchema }))
	.output(
		z
			.object({
				recipeId: z.string().uuid(),
				content: extractedRecipeSchema,
				isCurated: z.boolean(),
				servedLocale: z.string(),
			})
			.nullable(),
	)
	.handler(async ({ input }) => {
		const recipe = await loadSharedRecipe(input);
		if (!recipe) {
			return null;
		}
		return {
			recipeId: recipe.recipeId,
			content: recipe.content,
			isCurated: recipe.isCurated,
			servedLocale: recipe.servedLocale,
		};
	});

export const enableShare = protectedProcedure
	.route({
		method: "POST",
		path: "/recipes/{recipeId}/share",
		tags: ["Recipes"],
		summary: "Turn on an unguessable share link",
		description:
			"The owner can share a private recipe. Curated recipes already have a public page. This does not spend a credit.",
	})
	.input(
		z.object({
			recipeId: z.string().uuid(),
			locale: localeSchema,
		}),
	)
	.output(shareResult)
	.handler(async ({ input, context }) => {
		const recipe = await ownedRecipe(context.user.id, input.recipeId);
		if (recipe.isCurated) {
			return {
				shared: true,
				path: publicRecipePath(input.locale, recipe.id),
			};
		}

		if (recipe.shareToken) {
			return {
				shared: true,
				path: sharedRecipePath(input.locale, recipe.shareToken),
			};
		}

		const token = createShareToken();
		const updated = await db
			.update(recipes)
			.set({ shareToken: token, updatedAt: new Date() })
			.where(and(eq(recipes.id, recipe.id), isNull(recipes.shareToken)))
			.returning({ shareToken: recipes.shareToken });
		if (updated.length > 0) {
			return {
				shared: true,
				path: sharedRecipePath(input.locale, token),
			};
		}

		const current = await db.query.recipes.findFirst({
			where: eq(recipes.id, recipe.id),
		});
		if (!current?.shareToken) {
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
		return {
			shared: true,
			path: sharedRecipePath(input.locale, current.shareToken),
		};
	});

export const disableShare = protectedProcedure
	.route({
		method: "DELETE",
		path: "/recipes/{recipeId}/share",
		tags: ["Recipes"],
		summary: "Stop sharing a recipe",
	})
	.input(z.object({ recipeId: z.string().uuid() }))
	.output(z.object({ shared: z.literal(false) }))
	.handler(async ({ input, context }) => {
		const recipe = await ownedRecipe(context.user.id, input.recipeId);
		if (recipe.shareToken) {
			await db
				.update(recipes)
				.set({ shareToken: null, updatedAt: new Date() })
				.where(eq(recipes.id, recipe.id));
		}
		return { shared: false as const };
	});
