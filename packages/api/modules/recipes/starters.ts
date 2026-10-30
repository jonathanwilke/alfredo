import { dishName } from "@repo/ai";
import { db, icons, recipes } from "@repo/database";
import { starterCount } from "@repo/payments";
import { and, eq, inArray } from "drizzle-orm";
import { unstable_cache } from "next/cache";

function totalTimeSeconds(content: {
	prepTimeSeconds: number | null;
	cookTimeSeconds: number | null;
}) {
	const parts = [content.prepTimeSeconds, content.cookTimeSeconds].filter(
		(value): value is number => value != null && value > 0,
	);
	if (parts.length === 0) {
		return null;
	}
	return parts.reduce((sum, value) => sum + value, 0);
}

function shuffle<T>(items: readonly T[]) {
	const copy = [...items];
	for (let index = copy.length - 1; index > 0; index--) {
		const swap = Math.floor(Math.random() * (index + 1));
		const left = copy[index];
		const right = copy[swap];
		if (left === undefined || right === undefined) {
			continue;
		}
		copy[index] = right;
		copy[swap] = left;
	}
	return copy;
}

const starterCatalog = unstable_cache(
	async (locale: string) => loadStarterCatalog(locale),
	["starter-catalog"],
	{ revalidate: 300 },
);

async function loadStarterCatalog(locale: string) {
	const rows = await db.query.recipes.findMany({
		where: and(eq(recipes.isCurated, true), eq(recipes.source, "curated")),
		with: { translations: true },
	});

	const ready = rows.flatMap((recipe) => {
		const translation =
			recipe.translations.find((item) => item.locale === locale) ??
			recipe.translations[0];
		if (!translation) {
			return [];
		}
		const image = translation.content.image?.trim() || null;
		const servings =
			translation.content.servings > 0 ? translation.content.servings : 1;
		return [
			{
				recipeId: recipe.id,
				title: dishName(translation.content.title),
				servedLocale: translation.locale,
				image,
				servings,
				totalTimeSeconds: totalTimeSeconds(translation.content),
			},
		];
	});

	const ids = ready.map((recipe) => recipe.recipeId);
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

	return ready.map((recipe) => ({
		...recipe,
		heroIconUrl: heroById.get(recipe.recipeId) ?? null,
	}));
}

export async function listStarterRecipes(locale: string) {
	const catalog = await starterCatalog(locale);
	return shuffle(catalog).slice(0, starterCount(catalog.length));
}
