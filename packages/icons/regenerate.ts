import { processIconJobs, requeueRecipeDish } from "./jobs";

const recipeId = process.argv[2]?.trim() ?? "";

if (!recipeId) {
	console.error("Usage: pnpm icons:regenerate <recipeId>");
	console.error(
		"Rebuilds one dish photo from the recipe stored in the database. This calls the image model.",
	);
	process.exit(1);
}

const iconId = await requeueRecipeDish(recipeId);
await processIconJobs([iconId]);
console.log(iconId);
