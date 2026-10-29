import { ORPCError } from "@orpc/server";
import { dishName } from "@repo/ai";
import { auth } from "@repo/auth";
import { db, recipes, savedRecipes } from "@repo/database";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, publicProcedure } from "../../../orpc/procedures";

const recipeIdSchema = z.object({
	recipeId: z.string().uuid(),
});

async function requireRecipe(recipeId: string) {
	const recipe = await db.query.recipes.findFirst({
		where: eq(recipes.id, recipeId),
	});

	if (!recipe) {
		throw new ORPCError("NOT_FOUND");
	}
}

export const recipeSaved = publicProcedure
	.route({
		method: "GET",
		path: "/recipes/{recipeId}/saved",
		tags: ["Recipes"],
		summary: "Whether the signed-in user saved this recipe",
	})
	.input(recipeIdSchema)
	.output(z.object({ saved: z.boolean() }))
	.handler(async ({ input, context }) => {
		const session = await auth.api.getSession({
			headers: context.headers,
		});

		if (!session) {
			return { saved: false };
		}

		const row = await db.query.savedRecipes.findFirst({
			where: and(
				eq(savedRecipes.userId, session.user.id),
				eq(savedRecipes.recipeId, input.recipeId),
			),
		});

		return { saved: Boolean(row) };
	});

export const saveRecipe = protectedProcedure
	.route({
		method: "POST",
		path: "/recipes/{recipeId}/save",
		tags: ["Recipes"],
		summary: "Save a recipe for the signed-in user",
	})
	.input(recipeIdSchema)
	.output(z.object({ saved: z.literal(true) }))
	.handler(async ({ input, context }) => {
		await requireRecipe(input.recipeId);
		await db
			.insert(savedRecipes)
			.values({
				userId: context.user.id,
				recipeId: input.recipeId,
			})
			.onConflictDoNothing({
				target: [savedRecipes.userId, savedRecipes.recipeId],
			});

		return { saved: true as const };
	});

const localeSchema = z.enum(["de", "en"]);

export const listSavedRecipes = protectedProcedure
	.route({
		method: "GET",
		path: "/recipes/saved",
		tags: ["Recipes"],
		summary: "Saved recipes for the signed-in user",
	})
	.input(z.object({ locale: localeSchema }))
	.output(
		z.array(
			z.object({
				recipeId: z.string().uuid(),
				title: z.string(),
			}),
		),
	)
	.handler(async ({ input, context }) => {
		const rows = await db.query.savedRecipes.findMany({
			where: eq(savedRecipes.userId, context.user.id),
			orderBy: (table, operators) => [operators.desc(table.createdAt)],
			with: {
				recipe: {
					with: { translations: true },
				},
			},
		});

		return rows.flatMap((row) => {
			const translations = row.recipe?.translations ?? [];
			const translation =
				translations.find((item) => item.locale === input.locale) ??
				translations[0];
			if (!translation) {
				return [];
			}
			return [
				{
					recipeId: row.recipeId,
					title: dishName(translation.content.title),
				},
			];
		});
	});

export const unsaveRecipe = protectedProcedure
	.route({
		method: "DELETE",
		path: "/recipes/{recipeId}/save",
		tags: ["Recipes"],
		summary: "Remove a saved recipe for the signed-in user",
	})
	.input(recipeIdSchema)
	.output(z.object({ saved: z.literal(false) }))
	.handler(async ({ input, context }) => {
		await db
			.delete(savedRecipes)
			.where(
				and(
					eq(savedRecipes.userId, context.user.id),
					eq(savedRecipes.recipeId, input.recipeId),
				),
			);

		return { saved: false as const };
	});
