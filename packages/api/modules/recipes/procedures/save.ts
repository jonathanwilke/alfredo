import { ORPCError } from "@orpc/server";
import { dishName } from "@repo/ai";
import { auth } from "@repo/auth";
import { db, icons, imports, recipes, savedRecipes } from "@repo/database";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, publicProcedure } from "../../../orpc/procedures";
import {
	findOwnedCopy,
	insertRecipeCopy,
	planRecipeSave,
} from "../copy-recipe";

const recipeIdSchema = z.object({
	recipeId: z.string().uuid(),
});

async function bookmark(userId: string, recipeId: string) {
	const row = await db.query.savedRecipes.findFirst({
		where: and(
			eq(savedRecipes.userId, userId),
			eq(savedRecipes.recipeId, recipeId),
		),
	});
	return Boolean(row);
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

		const userId = session.user.id;
		if (await bookmark(userId, input.recipeId)) {
			return { saved: true };
		}

		const copy = await findOwnedCopy(userId, input.recipeId);
		if (copy && (await bookmark(userId, copy.id))) {
			return { saved: true };
		}

		return { saved: false };
	});

export const saveRecipe = protectedProcedure
	.route({
		method: "POST",
		path: "/recipes/{recipeId}/save",
		tags: ["Recipes"],
		summary: "Save a recipe for the signed-in user",
		description:
			"Saving a recipe the user does not own copies it onto their account, including translations and the existing dish photo. The copy is free. Saving the same recipe again returns that copy.",
	})
	.input(recipeIdSchema)
	.output(z.object({ saved: z.literal(true), recipeId: z.string().uuid() }))
	.handler(async ({ input, context }) => {
		const source = await db.query.recipes.findFirst({
			where: eq(recipes.id, input.recipeId),
			with: { translations: true },
		});
		if (!source) {
			throw new ORPCError("NOT_FOUND");
		}

		const imported = await db.query.imports.findFirst({
			where: and(
				eq(imports.userId, context.user.id),
				eq(imports.recipeId, source.id),
			),
		});
		const existingCopy = await findOwnedCopy(context.user.id, source.id);
		const plan = planRecipeSave({
			viewerUserId: context.user.id,
			recipeUserId: source.userId,
			hasImport: Boolean(imported),
			existingCopyId: existingCopy?.id ?? null,
			sourceRecipeId: source.id,
		});
		let recipeId: string;
		if (plan.action === "bookmark") {
			recipeId = plan.recipeId;
		} else {
			const hero = await db.query.icons.findFirst({
				where: and(eq(icons.kind, "recipe"), eq(icons.key, source.id)),
			});
			recipeId = await insertRecipeCopy({
				userId: context.user.id,
				sourceRecipeId: source.id,
				rawData: source.rawData,
				translations: source.translations.map((translation) => ({
					locale: translation.locale,
					content: translation.content,
				})),
				hero: hero
					? {
							storageUrl: hero.storageUrl,
							prompt: hero.prompt,
							model: hero.model,
							status: hero.status,
						}
					: null,
			});
		}

		await db
			.insert(savedRecipes)
			.values({
				userId: context.user.id,
				recipeId,
			})
			.onConflictDoNothing({
				target: [savedRecipes.userId, savedRecipes.recipeId],
			});

		return { saved: true as const, recipeId };
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
				image: z.string().nullable(),
				heroIconUrl: z.string().nullable(),
				servings: z.number().positive(),
				totalTimeSeconds: z.number().int().nonnegative().nullable(),
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

		const shown = rows.flatMap((row) => {
			const translations = row.recipe?.translations ?? [];
			const translation =
				translations.find((item) => item.locale === input.locale) ??
				translations[0];
			if (!translation) {
				return [];
			}
			const content = translation.content;
			const parts = [
				content.prepTimeSeconds,
				content.cookTimeSeconds,
			].filter((value): value is number => value != null && value > 0);
			return [
				{
					recipeId: row.recipeId,
					title: dishName(content.title),
					image: content.image?.trim() || null,
					servings: content.servings > 0 ? content.servings : 1,
					totalTimeSeconds:
						parts.length === 0
							? null
							: parts.reduce((sum, value) => sum + value, 0),
				},
			];
		});

		const ids = shown.map((recipe) => recipe.recipeId);
		const heroes =
			ids.length === 0
				? []
				: await db
						.select({
							key: icons.key,
							storageUrl: icons.storageUrl,
						})
						.from(icons)
						.where(
							and(
								eq(icons.kind, "recipe"),
								eq(icons.status, "ready"),
								inArray(icons.key, ids),
							),
						);
		const heroById = new Map(
			heroes.flatMap((icon) =>
				icon.storageUrl ? [[icon.key, icon.storageUrl] as const] : [],
			),
		);

		return shown.map((recipe) => ({
			...recipe,
			heroIconUrl: heroById.get(recipe.recipeId) ?? null,
		}));
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
		const copy = await findOwnedCopy(context.user.id, input.recipeId);
		const recipeIds = copy ? [input.recipeId, copy.id] : [input.recipeId];
		await db
			.delete(savedRecipes)
			.where(
				and(
					eq(savedRecipes.userId, context.user.id),
					inArray(savedRecipes.recipeId, recipeIds),
				),
			);

		return { saved: false as const };
	});
