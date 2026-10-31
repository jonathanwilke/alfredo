import { dishName } from "@repo/ai";
import { getBaseUrl } from "@repo/config";
import {
	db,
	icons,
	recipes,
	recipeTranslations,
	savedRecipes,
} from "@repo/database";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { clampText } from "../recipes/access";
import { readyDishUrl } from "../recipes/dish-url";
import { viewerOwnsRecipe } from "../recipes/import-recipe";
import {
	canReadMcpRecipe,
	decodeRecipeCursor,
	encodeRecipeCursor,
	formatMcpRecipe,
	type McpRecipe,
	type RecipeCursor,
	recipeLinks,
} from "./reference";

export type McpRecipeSummary = {
	id: string;
	title: string;
	description: string | null;
	imageUrl: string | null;
	url: string;
	curated: boolean;
};

function titleFilter(query: string) {
	const pattern = `%${query.replace(/[%_\\]/g, "")}%`;
	return sql`exists (
		select 1 from ${recipeTranslations}
		where ${recipeTranslations.recipeId} = ${recipes.id}
			and ${recipeTranslations.content}->>'title' ilike ${pattern}
	)`;
}

function accessFilter(userId: string) {
	return or(
		eq(recipes.userId, userId),
		eq(recipes.isCurated, true),
		sql`exists (
			select 1 from ${savedRecipes}
			where ${savedRecipes.userId} = ${userId}
				and ${savedRecipes.recipeId} = ${recipes.id}
		)`,
	);
}

export async function listReadableRecipes(input: {
	userId: string;
	locale: string;
	query?: string;
	limit: number;
	cursor?: string | null;
	baseUrl?: string;
}): Promise<{ recipes: McpRecipeSummary[]; nextCursor: string | null }> {
	const limit = Math.min(50, Math.max(1, input.limit));
	const cursor = input.cursor ? decodeRecipeCursor(input.cursor) : null;
	if (input.cursor && !cursor) {
		throw new Error("invalid_cursor");
	}
	const query = input.query?.trim();
	const baseUrl = input.baseUrl ?? getBaseUrl();
	const rows = await db.query.recipes.findMany({
		where: and(
			accessFilter(input.userId),
			query ? titleFilter(query) : undefined,
			cursor
				? or(
						lt(recipes.createdAt, new Date(cursor.createdAt)),
						and(
							eq(recipes.createdAt, new Date(cursor.createdAt)),
							lt(recipes.id, cursor.id),
						),
					)
				: undefined,
		),
		orderBy: [desc(recipes.createdAt), desc(recipes.id)],
		limit: limit + 1,
		with: { translations: true },
	});
	const page = rows.slice(0, limit);
	const ids = page.map((recipe) => recipe.id);
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

	const recipesOnPage = page.flatMap((recipe) => {
		const translation =
			recipe.translations.find((item) => item.locale === input.locale) ??
			recipe.translations[0];
		if (!translation) {
			return [];
		}
		const links = recipeLinks(baseUrl, translation.locale, recipe.id);
		const description = translation.content.description?.trim();
		const image =
			heroById.get(recipe.id) ??
			translation.content.image?.trim() ??
			null;
		return [
			{
				id: recipe.id,
				title: dishName(translation.content.title),
				description: description ? clampText(description, 180) : null,
				imageUrl: image && /^https?:\/\//i.test(image) ? image : null,
				url: links.url,
				curated: recipe.isCurated,
			},
		];
	});

	const last = page.at(-1);
	const nextCursor =
		rows.length > limit && last
			? encodeRecipeCursor({
					createdAt: last.createdAt.toISOString(),
					id: last.id,
				} satisfies RecipeCursor)
			: null;

	return { recipes: recipesOnPage, nextCursor };
}

export async function getReadableRecipe(input: {
	userId: string;
	recipeId: string;
	locale: string;
	baseUrl?: string;
}): Promise<McpRecipe | null> {
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
	const owns = await viewerOwnsRecipe(input.userId, recipe);
	const saved = owns
		? false
		: Boolean(
				await db.query.savedRecipes.findFirst({
					where: and(
						eq(savedRecipes.userId, input.userId),
						eq(savedRecipes.recipeId, recipe.id),
					),
				}),
			);
	if (
		!canReadMcpRecipe({
			isCurated: recipe.isCurated,
			owns,
			saved,
		})
	) {
		return null;
	}
	const translation =
		recipe.translations.find((item) => item.locale === input.locale) ??
		recipe.translations[0];
	if (!translation) {
		return null;
	}
	const imageUrl = await readyDishUrl(recipe.id);
	return formatMcpRecipe({
		id: recipe.id,
		locale: translation.locale,
		curated: recipe.isCurated,
		sourceUrl: recipe.sourceUrl,
		content: {
			...translation.content,
			title: dishName(translation.content.title),
		},
		imageUrl,
		baseUrl: input.baseUrl ?? getBaseUrl(),
	});
}
