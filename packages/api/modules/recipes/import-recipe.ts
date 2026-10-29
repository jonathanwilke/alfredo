import {
	describeDish,
	dishName,
	type ExtractedRecipe,
	extractRecipe,
	RecipeUrlCheckError,
	recipeUrlLooksLegitimate,
} from "@repo/ai";
import { auth } from "@repo/auth";
import {
	db,
	recipes,
	recipeTranslations,
	rejectedDomains,
	savedRecipes,
} from "@repo/database";
import { enqueueRecipeIcons, processIconJobs } from "@repo/icons";
import {
	assertCreditsAvailable,
	debitRecipeCredit,
	estimateGenerationCost,
	resolveRecipeCharge,
	userImportedRecipeValues,
} from "@repo/payments";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import {
	fetchRecipeSource,
	ImportError,
	normalizeRecipeUrl,
	recipeDomain,
} from "./source";

export interface StoredRecipe {
	recipeId: string;
	sourceUrl: string;
	content: ExtractedRecipe;
	isCurated: boolean;
	servedLocale: string;
}

async function saveForSignedInUser(input: {
	headers: Headers;
	recipeId: string;
}) {
	const session = await auth.api.getSession({ headers: input.headers });
	if (!session) {
		return;
	}

	await db
		.insert(savedRecipes)
		.values({
			userId: session.user.id,
			recipeId: input.recipeId,
		})
		.onConflictDoNothing({
			target: [savedRecipes.userId, savedRecipes.recipeId],
		});
}

async function queueIcons(recipeId: string, content: ExtractedRecipe) {
	try {
		const ids = await enqueueRecipeIcons({
			recipeId,
			title: content.title,
			ingredientKeys: content.ingredients.map(
				(ingredient) => ingredient.canonicalKey,
			),
		});

		if (ids.length > 0) {
			after(async () => {
				await processIconJobs(ids);
			});
		}
	} catch (error) {
		console.error("icon enqueue failed", error);
	}
}

function storedFrom(
	recipe: { id: string; sourceUrl: string; isCurated: boolean },
	translation: { locale: string; content: ExtractedRecipe },
): StoredRecipe {
	return {
		recipeId: recipe.id,
		sourceUrl: recipe.sourceUrl,
		isCurated: recipe.isCurated,
		servedLocale: translation.locale,
		content: {
			...translation.content,
			title: dishName(translation.content.title),
		},
	};
}

export async function loadRecipe(input: {
	recipeId: string;
	locale: string;
}): Promise<StoredRecipe | null> {
	if (!z.string().uuid().safeParse(input.recipeId).success) {
		return null;
	}
	const recipe = await db.query.recipes.findFirst({
		where: eq(recipes.id, input.recipeId),
		with: { translations: true },
	});
	if (!recipe) {
		return null;
	}

	const decision = resolveRecipeCharge({
		existing: {
			isCurated: recipe.isCurated,
			locales: recipe.translations.map(
				(translation) => translation.locale,
			),
		},
		requestedLocale: input.locale,
	});
	if (decision.action !== "serve") {
		return null;
	}

	const translation = recipe.translations.find(
		(item) => item.locale === decision.locale,
	);
	if (!translation) {
		return null;
	}
	return storedFrom(recipe, translation);
}

export async function ensureRecipeDescription(
	recipe: StoredRecipe,
	locale: string,
): Promise<StoredRecipe> {
	if (recipe.isCurated || recipe.content.description?.trim()) {
		return recipe;
	}

	try {
		const description = await describeDish({
			title: recipe.content.title,
			ingredients: recipe.content.ingredients.map(
				(ingredient) => ingredient.name,
			),
			locale,
		});
		if (!description) {
			return recipe;
		}

		const content = { ...recipe.content, description };
		await db
			.update(recipeTranslations)
			.set({ content, updatedAt: new Date() })
			.where(
				and(
					eq(recipeTranslations.recipeId, recipe.recipeId),
					eq(recipeTranslations.locale, locale),
				),
			);

		return { ...recipe, content };
	} catch (error) {
		console.error("recipe description failed", error);
		return recipe;
	}
}

export async function importRecipeFromUrl(input: {
	url: string;
	locale: string;
	headers: Headers;
}): Promise<StoredRecipe> {
	const url = normalizeRecipeUrl(input.url);
	const sourceUrl = url.href;
	const existing = await db.query.recipes.findFirst({
		where: eq(recipes.sourceUrl, sourceUrl),
		with: { translations: true },
	});
	const decision = resolveRecipeCharge({
		existing: existing
			? {
					isCurated: existing.isCurated,
					locales: existing.translations.map(
						(translation) => translation.locale,
					),
				}
			: null,
		requestedLocale: input.locale,
	});

	if (decision.action === "serve") {
		const translation = existing?.translations.find(
			(item) => item.locale === decision.locale,
		);
		if (!existing || !translation) {
			throw new ImportError("not_a_recipe");
		}
		await queueIcons(existing.id, translation.content);
		return storedFrom(existing, translation);
	}

	const domain = recipeDomain(url);
	const blocked = await db.query.rejectedDomains.findFirst({
		where: eq(rejectedDomains.domain, domain),
	});
	if (blocked) {
		throw new ImportError("not_a_recipe");
	}

	const session = await auth.api.getSession({ headers: input.headers });
	if (!session) {
		throw new ImportError("account_required");
	}
	await assertCreditsAvailable(session.user.id);

	try {
		const allowed = await recipeUrlLooksLegitimate(sourceUrl);
		if (!allowed) {
			await db
				.insert(rejectedDomains)
				.values({ domain })
				.onConflictDoNothing();
			throw new ImportError("not_a_recipe");
		}
	} catch (error) {
		if (error instanceof ImportError) {
			throw error;
		}
		if (error instanceof RecipeUrlCheckError) {
			throw new ImportError(
				error.reason === "not_configured"
					? "not_configured"
					: "extract_failed",
			);
		}
		throw new ImportError("extract_failed");
	}

	const sourceText = await fetchRecipeSource(url);
	let content: ExtractedRecipe;
	let usage: {
		model: string;
		inputTokens: number;
		outputTokens: number;
	};
	try {
		const extracted = await extractRecipe({
			sourceText,
			locale: input.locale,
		});
		if (!extracted) {
			throw new ImportError("extract_failed");
		}
		content = extracted.recipe;
		usage = extracted.usage;
	} catch (error) {
		if (error instanceof ImportError) {
			throw error;
		}
		const message = error instanceof Error ? error.message : "";
		if (message.includes("AI_GATEWAY")) {
			throw new ImportError("not_configured");
		}
		throw new ImportError("extract_failed");
	}

	if (
		!content.title.trim() ||
		(content.ingredients.length === 0 && content.steps.length === 0)
	) {
		throw new ImportError("not_a_recipe");
	}

	const userId = session.user.id;

	const stored = await db.transaction(async (tx) => {
		const insertedRecipe = await tx
			.insert(recipes)
			.values(userImportedRecipeValues(sourceUrl))
			.onConflictDoNothing({ target: recipes.sourceUrl })
			.returning({ id: recipes.id });

		const recipe =
			insertedRecipe[0] != null
				? {
						id: insertedRecipe[0].id,
						sourceUrl,
						isCurated: false,
					}
				: await tx.query.recipes.findFirst({
						where: eq(recipes.sourceUrl, sourceUrl),
						with: { translations: true },
					});
		if (!recipe) {
			throw new ImportError("extract_failed");
		}

		if (recipe.isCurated) {
			const curated = await tx.query.recipes.findFirst({
				where: eq(recipes.id, recipe.id),
				with: { translations: true },
			});
			const translation =
				curated?.translations.find(
					(item) => item.locale === input.locale,
				) ?? curated?.translations[0];
			if (!curated || !translation) {
				throw new ImportError("not_a_recipe");
			}
			return storedFrom(curated, translation);
		}

		const inserted = await tx
			.insert(recipeTranslations)
			.values({
				recipeId: recipe.id,
				locale: input.locale,
				content,
			})
			.onConflictDoNothing({
				target: [
					recipeTranslations.recipeId,
					recipeTranslations.locale,
				],
			})
			.returning({ id: recipeTranslations.id });

		if (!inserted[0]) {
			const cached = await tx.query.recipeTranslations.findFirst({
				where: and(
					eq(recipeTranslations.recipeId, recipe.id),
					eq(recipeTranslations.locale, input.locale),
				),
			});
			if (!cached) {
				throw new ImportError("extract_failed");
			}
			return storedFrom(
				{ id: recipe.id, sourceUrl, isCurated: false },
				cached,
			);
		}

		await debitRecipeCredit(tx, {
			userId,
			recipeId: recipe.id,
			locale: input.locale,
			importType: insertedRecipe[0] ? "import" : "translation",
			usage: {
				model: usage.model,
				inputTokens: usage.inputTokens,
				outputTokens: usage.outputTokens,
				estimatedCostMicroUsd:
					estimateGenerationCost(usage).estimatedCostMicroUsd,
			},
		});

		return storedFrom(
			{ id: recipe.id, sourceUrl, isCurated: false },
			{ locale: input.locale, content },
		);
	});

	if (decision.reason === "import") {
		await saveForSignedInUser({
			headers: input.headers,
			recipeId: stored.recipeId,
		});
	}

	await queueIcons(stored.recipeId, stored.content);
	return stored;
}
