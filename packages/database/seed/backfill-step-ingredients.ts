import { applyStepIngredients } from "@repo/cooking";
import { db, recipeTranslations } from "@repo/database";
import { eq } from "drizzle-orm";

const write = process.argv.includes("--write");

async function main() {
	const rows = await db.select().from(recipeTranslations);
	let changed = 0;

	for (const row of rows) {
		const next = applyStepIngredients(row.content);
		const before = JSON.stringify(row.content.steps);
		const after = JSON.stringify(next.steps);
		if (before === after) {
			continue;
		}
		changed += 1;
		console.log(
			`${write ? "update" : "would update"} ${row.recipeId} ${row.locale}`,
		);
		if (write) {
			await db
				.update(recipeTranslations)
				.set({ content: next, updatedAt: new Date() })
				.where(eq(recipeTranslations.id, row.id));
		}
	}

	console.log(
		write
			? `Updated ${changed} of ${rows.length} translations.`
			: `Dry run: ${changed} of ${rows.length} translations would change. Pass --write to store them.`,
	);
}

main()
	.then(() => process.exit(0))
	.catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
