import { dishName } from "@repo/ai";
import { db, recipes } from "@repo/database";
import { starterCount } from "@repo/payments";
import { and, eq, sql } from "drizzle-orm";

export async function listStarterRecipes(locale: string) {
	const rows = await db.query.recipes.findMany({
		where: and(eq(recipes.isCurated, true), eq(recipes.source, "curated")),
		with: { translations: true },
		orderBy: sql`random()`,
		limit: 6,
	});

	const ready = rows.flatMap((recipe) => {
		const translation =
			recipe.translations.find((item) => item.locale === locale) ??
			recipe.translations[0];
		if (!translation) {
			return [];
		}
		return [
			{
				recipeId: recipe.id,
				title: dishName(translation.content.title),
				servedLocale: translation.locale,
			},
		];
	});

	return ready.slice(0, starterCount(ready.length));
}
