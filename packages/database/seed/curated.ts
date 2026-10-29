import { db, recipes, recipeTranslations } from "@repo/database";
import { eq } from "drizzle-orm";
import { curatedFixtures } from "./recipes";

for (const fixture of curatedFixtures) {
	if (fixture.source !== "curated" || fixture.isCurated !== true) {
		throw new Error(`Refusing to seed ${fixture.sourceUrl}`);
	}
}

async function seed() {
	for (const fixture of curatedFixtures) {
		const [row] = await db
			.insert(recipes)
			.values({
				sourceUrl: fixture.sourceUrl,
				rawData: {},
				isCurated: true,
				source: "curated",
			})
			.onConflictDoUpdate({
				target: recipes.sourceUrl,
				set: {
					isCurated: true,
					source: "curated",
					updatedAt: new Date(),
				},
			})
			.returning({ id: recipes.id });

		if (!row) {
			throw new Error(`Could not store ${fixture.sourceUrl}`);
		}

		for (const [locale, content] of Object.entries(fixture.translations)) {
			await db
				.insert(recipeTranslations)
				.values({ recipeId: row.id, locale, content })
				.onConflictDoUpdate({
					target: [
						recipeTranslations.recipeId,
						recipeTranslations.locale,
					],
					set: { content, updatedAt: new Date() },
				});
		}

		const stored = await db.query.recipes.findFirst({
			where: eq(recipes.id, row.id),
		});
		if (!stored?.isCurated || stored.source !== "curated") {
			throw new Error(
				`Seed wrote a billable row for ${fixture.sourceUrl}`,
			);
		}
	}

	console.log(`Seeded ${curatedFixtures.length} curated recipes.`);
}

seed()
	.then(() => process.exit(0))
	.catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
