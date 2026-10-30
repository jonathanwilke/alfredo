import type { ExtractedRecipe } from "@repo/ai";
import { db, icons, recipes, recipeTranslations } from "@repo/database";
import { and, eq } from "drizzle-orm";

export function copySourceUrl(userId: string, sourceRecipeId: string) {
	return `ulivo-copy://${userId}/${sourceRecipeId}`;
}

export function planRecipeSave(input: {
	viewerUserId: string;
	recipeUserId: string | null;
	hasImport: boolean;
	existingCopyId: string | null;
	sourceRecipeId: string;
}) {
	const ownsRecipe =
		input.recipeUserId === input.viewerUserId || input.hasImport;
	if (ownsRecipe) {
		return { action: "bookmark" as const, recipeId: input.sourceRecipeId };
	}
	if (input.existingCopyId) {
		return { action: "bookmark" as const, recipeId: input.existingCopyId };
	}

	return { action: "copy" as const };
}

export function copyRecipeRow(input: {
	userId: string;
	sourceRecipeId: string;
	rawData: Record<string, unknown>;
}) {
	return {
		sourceUrl: copySourceUrl(input.userId, input.sourceRecipeId),
		rawData: structuredClone(input.rawData),
		isCurated: false as const,
		source: "copy" as const,
		userId: input.userId,
		sourceRecipeId: input.sourceRecipeId,
	};
}

export function cloneRecipeContent(content: ExtractedRecipe) {
	return structuredClone(content);
}

export function copiedHeroIcon(input: {
	copyRecipeId: string;
	source: {
		storageUrl: string | null;
		prompt: string;
		model: string;
		status: "pending" | "ready" | "failed";
	} | null;
}) {
	if (!input.source?.storageUrl || input.source.status !== "ready") {
		return null;
	}

	return {
		kind: "recipe" as const,
		key: input.copyRecipeId,
		recipeId: input.copyRecipeId,
		storageUrl: input.source.storageUrl,
		prompt: input.source.prompt,
		model: input.source.model,
		status: input.source.status,
	};
}

export async function findOwnedCopy(userId: string, sourceRecipeId: string) {
	return db.query.recipes.findFirst({
		where: and(
			eq(recipes.userId, userId),
			eq(recipes.sourceRecipeId, sourceRecipeId),
		),
	});
}

/**
 * Inserts an independent recipe, its translations, and a hero-icon row that
 * points at the source photo. Does not call the image model or debit a credit.
 */
export async function insertRecipeCopy(input: {
	userId: string;
	sourceRecipeId: string;
	rawData: Record<string, unknown>;
	translations: { locale: string; content: ExtractedRecipe }[];
	hero: {
		storageUrl: string | null;
		prompt: string;
		model: string;
		status: "pending" | "ready" | "failed";
	} | null;
}) {
	const values = copyRecipeRow(input);
	return db.transaction(async (tx) => {
		const [created] = await tx
			.insert(recipes)
			.values(values)
			.onConflictDoNothing({ target: recipes.sourceUrl })
			.returning({ id: recipes.id });

		if (!created) {
			const existing = await tx.query.recipes.findFirst({
				where: eq(recipes.sourceUrl, values.sourceUrl),
			});
			if (!existing) {
				throw new Error("Recipe copy was not created.");
			}
			return existing.id;
		}

		if (input.translations.length > 0) {
			await tx.insert(recipeTranslations).values(
				input.translations.map((translation) => ({
					recipeId: created.id,
					locale: translation.locale,
					content: cloneRecipeContent(translation.content),
				})),
			);
		}

		const hero = copiedHeroIcon({
			copyRecipeId: created.id,
			source: input.hero,
		});
		if (hero) {
			await tx.insert(icons).values(hero);
		}

		return created.id;
	});
}
