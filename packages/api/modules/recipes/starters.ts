import { dishName } from "@repo/ai";
import { db, icons, recipes } from "@repo/database";
import { starterCount } from "@repo/payments";
import { and, eq, inArray, sql } from "drizzle-orm";

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

export async function listStarterRecipes(locale: string) {
	const rows = await db.query.recipes.findMany({
		where: and(eq(recipes.isCurated, true), eq(recipes.source, "curated")),
		with: { translations: true },
		orderBy: sql`random()`,
		limit: 10,
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

	const shown = ready.slice(0, starterCount(ready.length));
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
}
