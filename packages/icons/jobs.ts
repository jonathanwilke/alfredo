import { db, icons, recipeTranslations } from "@repo/database";
import { putPublicObject } from "@repo/storage";
import { and, eq, inArray } from "drizzle-orm";
import { renderIcon, subjectPrompt } from "./render";
import { imageModelId, normalizeIngredientKey } from "./style";

export interface RecipeIconRequest {
	recipeId: string;
	title: string;
	ingredientKeys: string[];
}

async function ensureRow(input: {
	kind: "ingredient" | "recipe";
	key: string;
	recipeId: string | null;
	subject: string;
}) {
	const model = imageModelId();
	const prompt = subjectPrompt(input.subject, input.kind);
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
				prompt,
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
			prompt,
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
 * Records icon jobs for a recipe. Does not generate images and does not
 * write an imports row, so it never counts toward the monthly quota.
 */
export async function enqueueRecipeIcons(input: RecipeIconRequest) {
	const ingredientKeys = [
		...new Set(input.ingredientKeys.map(normalizeIngredientKey)),
	];
	const rows = await Promise.all([
		ensureRow({
			kind: "recipe",
			key: input.recipeId,
			recipeId: input.recipeId,
			subject: input.title,
		}),
		...ingredientKeys.map((key) =>
			ensureRow({
				kind: "ingredient",
				key,
				recipeId: null,
				subject: key.replaceAll("-", " "),
			}),
		),
	]);

	return rows.filter((row) => row.status === "pending").map((row) => row.id);
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
			const rendered = await renderIcon(
				row.prompt,
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
	const translations = await db
		.select({ content: recipeTranslations.content })
		.from(recipeTranslations)
		.where(eq(recipeTranslations.recipeId, recipeId));
	const keys = [
		...new Set(
			translations.flatMap((translation) =>
				translation.content.ingredients.map((ingredient) =>
					normalizeIngredientKey(ingredient.canonicalKey),
				),
			),
		),
	];
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
