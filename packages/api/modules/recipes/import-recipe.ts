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
	imports,
	recipes,
	recipeTranslations,
	rejectedDomains,
	savedRecipes,
} from "@repo/database";
import { enqueueRecipeIcons, processIconJobs } from "@repo/icons";
import { assertImportAllowed } from "@repo/payments";
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
}

async function rememberImport(input: {
	headers: Headers;
	type: "import" | "translation";
}) {
	const session = await auth.api.getSession({ headers: input.headers });
	if (!session) {
		return;
	}

	await db.insert(imports).values({
		userId: session.user.id,
		type: input.type,
	});
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

export async function loadRecipe(input: {
	recipeId: string;
	locale: string;
}): Promise<StoredRecipe | null> {
	if (!z.string().uuid().safeParse(input.recipeId).success) {
		return null;
	}
	const translation = await db.query.recipeTranslations.findFirst({
		where: and(
			eq(recipeTranslations.recipeId, input.recipeId),
			eq(recipeTranslations.locale, input.locale),
		),
		with: { recipe: true },
	});

	if (!translation?.recipe) {
		return null;
	}

	return {
		recipeId: translation.recipeId,
		sourceUrl: translation.recipe.sourceUrl,
		content: {
			...translation.content,
			title: dishName(translation.content.title),
		},
	};
}

export async function ensureRecipeDescription(
	recipe: StoredRecipe,
	locale: string,
): Promise<StoredRecipe> {
	if (recipe.content.description?.trim()) {
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
	const cached = existing?.translations.find(
		(translation) => translation.locale === input.locale,
	);

	if (existing && cached) {
		await queueIcons(existing.id, cached.content);
		return {
			recipeId: existing.id,
			sourceUrl,
			content: cached.content,
		};
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
	await assertImportAllowed(session.user.id);

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
	try {
		const extracted = await extractRecipe({
			sourceText,
			locale: input.locale,
		});
		if (!extracted) {
			throw new ImportError("extract_failed");
		}
		content = extracted;
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

	const insertedRecipe = await db
		.insert(recipes)
		.values({ sourceUrl, rawData: {} })
		.onConflictDoNothing({ target: recipes.sourceUrl })
		.returning({ id: recipes.id });
	const recipeId = insertedRecipe[0]?.id ?? existing?.id;
	if (!recipeId) {
		const raced = await db.query.recipes.findFirst({
			where: eq(recipes.sourceUrl, sourceUrl),
		});
		if (!raced) {
			throw new ImportError("extract_failed");
		}
		return saveTranslation({
			recipeId: raced.id,
			sourceUrl,
			locale: input.locale,
			content,
			event: "translation",
			headers: input.headers,
		});
	}

	return saveTranslation({
		recipeId,
		sourceUrl,
		locale: input.locale,
		content,
		event: insertedRecipe[0] ? "import" : "translation",
		headers: input.headers,
	});
}

async function saveTranslation(input: {
	recipeId: string;
	sourceUrl: string;
	locale: string;
	content: ExtractedRecipe;
	event: "import" | "translation";
	headers: Headers;
}): Promise<StoredRecipe> {
	const inserted = await db
		.insert(recipeTranslations)
		.values({
			recipeId: input.recipeId,
			locale: input.locale,
			content: input.content,
		})
		.onConflictDoNothing({
			target: [recipeTranslations.recipeId, recipeTranslations.locale],
		})
		.returning({ id: recipeTranslations.id });

	if (inserted[0]) {
		await rememberImport({ headers: input.headers, type: input.event });
	}

	if (input.event === "import") {
		await saveForSignedInUser({
			headers: input.headers,
			recipeId: input.recipeId,
		});
	}

	const stored =
		inserted[0] != null
			? input.content
			: (
					await db.query.recipeTranslations.findFirst({
						where: and(
							eq(recipeTranslations.recipeId, input.recipeId),
							eq(recipeTranslations.locale, input.locale),
						),
					})
				)?.content;

	if (!stored) {
		throw new ImportError("extract_failed");
	}

	await queueIcons(input.recipeId, stored);

	return {
		recipeId: input.recipeId,
		sourceUrl: input.sourceUrl,
		content: stored,
	};
}
