import { db, icons, recipeTranslations } from "@repo/database";
import { putPublicObject } from "@repo/storage";
import { and, eq, inArray } from "drizzle-orm";
import { renderIcon, subjectPrompt } from "./render";
import { dishPromptInput, imageModelId, normalizeIngredientKey } from "./style";

export interface RecipeIconRequest {
	recipeId: string;
	title: string;
	ingredientKeys: string[];
}

async function ensureRow(input: {
	kind: "ingredient" | "recipe";
	key: string;
	recipeId: string | null;
	prompt: string;
}) {
	const model = imageModelId();
	const existing = await db.query.icons.findFirst({
		where: and(eq(icons.kind, input.kind), eq(icons.key, input.key)),
	});

	if (existing?.status === "ready" && existing.storageUrl) {
		return existing;
	}

	if (existing) {
		const [updated] = await db
			.update(icons)
			.set({
				status: "pending",
				prompt: input.prompt,
				model,
				updatedAt: new Date(),
			})
			.where(eq(icons.id, existing.id))
			.returning();
		return updated ?? existing;
	}

	const [created] = await db
		.insert(icons)
		.values({
			kind: input.kind,
			key: input.key,
			recipeId: input.recipeId,
			prompt: input.prompt,
			model,
			status: "pending",
		})
		.onConflictDoNothing({ target: [icons.kind, icons.key] })
		.returning();

	if (created) {
		return created;
	}

	const raced = await db.query.icons.findFirst({
		where: and(eq(icons.kind, input.kind), eq(icons.key, input.key)),
	});

	if (!raced) {
		throw new Error("Icon row was not created.");
	}

	return raced;
}

/**
 * English title and ingredient list for a dish photo.
 * Stored translations win over any title the caller passed.
 */
export async function loadDishPrompt(recipeId: string, fallbackTitle = "") {
	const translations = await db
		.select({
			locale: recipeTranslations.locale,
			content: recipeTranslations.content,
		})
		.from(recipeTranslations)
		.where(eq(recipeTranslations.recipeId, recipeId));

	return dishPromptInput(
		translations.map((translation) => ({
			locale: translation.locale,
			title: translation.content.title,
			ingredients: translation.content.ingredients.map((ingredient) => ({
				canonicalKey: ingredient.canonicalKey,
				form: ingredient.form,
			})),
		})),
		fallbackTitle,
	);
}

function normalizedIngredientKeys(values: string[]) {
	const keys = new Set<string>();
	for (const value of values) {
		try {
			keys.add(normalizeIngredientKey(value));
		} catch {
			// An ingredient with no usable name cannot have an icon.
		}
	}
	return [...keys];
}

async function ingredientKeysForRecipe(recipeId: string) {
	const translations = await db
		.select({ content: recipeTranslations.content })
		.from(recipeTranslations)
		.where(eq(recipeTranslations.recipeId, recipeId));

	return normalizedIngredientKeys(
		translations.flatMap((translation) =>
			translation.content.ingredients.map(
				(ingredient) => ingredient.canonicalKey,
			),
		),
	);
}

/**
 * Records icon jobs for a recipe. Does not generate images and does not
 * write an imports row or a credit ledger row, so it never spends a credit.
 * A ready dish photo is left unchanged.
 * The dish prompt is built from the stored ingredient list. ingredientKeys
 * only queue ingredient icons.
 */
export async function enqueueRecipeIcons(input: RecipeIconRequest) {
	const ingredientKeys = normalizedIngredientKeys(input.ingredientKeys);
	const dish = await loadDishPrompt(input.recipeId, input.title);
	const rows = await Promise.all([
		ensureRow({
			kind: "recipe",
			key: input.recipeId,
			recipeId: input.recipeId,
			prompt: subjectPrompt(
				dish?.title || input.title,
				"recipe",
				dish?.ingredients ?? [],
			),
		}),
		...ingredientKeys.map((key) =>
			ensureRow({
				kind: "ingredient",
				key,
				recipeId: null,
				prompt: subjectPrompt(key.replaceAll("-", " "), "ingredient"),
			}),
		),
	]);

	return rows.filter((row) => row.status === "pending").map((row) => row.id);
}

/**
 * Inserts pending rows for ingredient icons that were never queued.
 * Ready, pending, and failed icons are left unchanged.
 */
export async function enqueueMissingIngredientIcons(recipeId: string) {
	const keys = await ingredientKeysForRecipe(recipeId);
	if (keys.length === 0) {
		return [];
	}

	const existing = await db
		.select({ key: icons.key })
		.from(icons)
		.where(and(eq(icons.kind, "ingredient"), inArray(icons.key, keys)));
	const present = new Set(existing.map((icon) => icon.key));
	const missing = keys.filter((key) => !present.has(key));
	const ids: string[] = [];

	for (const key of missing) {
		const [created] = await db
			.insert(icons)
			.values({
				kind: "ingredient",
				key,
				recipeId: null,
				prompt: subjectPrompt(key.replaceAll("-", " "), "ingredient"),
				model: imageModelId(),
				status: "pending",
			})
			.onConflictDoNothing({ target: [icons.kind, icons.key] })
			.returning({ id: icons.id });
		if (created) {
			ids.push(created.id);
		}
	}

	return ids;
}

/**
 * Marks one dish photo pending and stores a prompt built from the recipe.
 * Does not call the image model. processIconJobs does that.
 */
export async function requeueRecipeDish(recipeId: string) {
	const dish = await loadDishPrompt(recipeId);
	if (!dish || dish.ingredients.length === 0) {
		throw new Error(`Recipe ${recipeId} has no stored ingredients.`);
	}

	const prompt = subjectPrompt(dish.title, "recipe", dish.ingredients);
	const model = imageModelId();
	const existing = await db.query.icons.findFirst({
		where: and(eq(icons.kind, "recipe"), eq(icons.key, recipeId)),
	});

	if (existing) {
		const [updated] = await db
			.update(icons)
			.set({
				status: "pending",
				prompt,
				model,
				recipeId,
				updatedAt: new Date(),
			})
			.where(eq(icons.id, existing.id))
			.returning({ id: icons.id });
		return updated?.id ?? existing.id;
	}

	const [created] = await db
		.insert(icons)
		.values({
			kind: "recipe",
			key: recipeId,
			recipeId,
			prompt,
			model,
			status: "pending",
		})
		.returning({ id: icons.id });

	if (!created) {
		throw new Error("Icon row was not created.");
	}

	return created.id;
}

export async function processIconJobs(ids: string[]) {
	if (ids.length === 0) {
		return;
	}

	const rows = await db.select().from(icons).where(inArray(icons.id, ids));

	for (const row of rows) {
		if (row.status === "ready" && row.storageUrl) {
			continue;
		}

		try {
			const label =
				row.kind === "ingredient"
					? row.key.replaceAll("-", " ")
					: row.key;
			let prompt = row.prompt;
			if (row.kind === "recipe") {
				const dish = await loadDishPrompt(row.recipeId ?? row.key);
				if (dish && dish.ingredients.length > 0) {
					prompt = subjectPrompt(
						dish.title,
						"recipe",
						dish.ingredients,
					);
				}
			}
			const rendered = await renderIcon(
				prompt,
				label,
				row.kind === "recipe" ? "wide" : "square",
			);
			const stored = await putPublicObject({
				key: `${row.kind}/${row.key}-${Date.now()}.webp`,
				body: rendered.webp,
				contentType: "image/webp",
			});

			await db
				.update(icons)
				.set({
					status: "ready",
					storageUrl: stored.url,
					model: rendered.model,
					prompt: rendered.prompt,
					updatedAt: new Date(),
				})
				.where(eq(icons.id, row.id));
		} catch (error) {
			console.error(error);
			await db
				.update(icons)
				.set({ status: "failed", updatedAt: new Date() })
				.where(eq(icons.id, row.id));
		}
	}
}

export async function listRecipeIcons(recipeId: string) {
	const recipeIcon = await db.query.icons.findFirst({
		where: and(eq(icons.kind, "recipe"), eq(icons.key, recipeId)),
	});
	const keys = await ingredientKeysForRecipe(recipeId);
	const ingredientIcons =
		keys.length === 0
			? []
			: await db
					.select()
					.from(icons)
					.where(
						and(
							eq(icons.kind, "ingredient"),
							inArray(icons.key, keys),
						),
					);

	return { recipeIcon, ingredientIcons };
}
