import { db, icons } from "@repo/database";
import { and, eq } from "drizzle-orm";
import { processIconJobs, requeueRecipeDish } from "./jobs";

function safeError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	return message
		.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://redacted")
		.slice(0, 300);
}

async function main() {
	const recipeId = process.argv[2]?.trim() ?? "";

	if (!recipeId) {
		console.error("Usage: pnpm icons:regenerate <recipeId>");
		console.error(
			"Rebuilds one dish photo from the recipe stored in the database. This calls the image model.",
		);
		process.exit(1);
	}

	const existing = await db.query.icons.findFirst({
		where: and(eq(icons.kind, "recipe"), eq(icons.key, recipeId)),
	});

	let iconId: string;
	try {
		iconId = await requeueRecipeDish(recipeId);
	} catch (error) {
		console.error(safeError(error));
		process.exit(1);
	}

	await processIconJobs([iconId]);

	const after = await db.query.icons.findFirst({
		where: eq(icons.id, iconId),
	});

	if (after?.status === "ready" && after.storageUrl) {
		console.log(after.storageUrl);
		process.exit(0);
	}

	if (existing?.status === "ready" && existing.storageUrl) {
		await db
			.update(icons)
			.set({
				status: "ready",
				storageUrl: existing.storageUrl,
				prompt: existing.prompt,
				model: existing.model,
				updatedAt: new Date(),
			})
			.where(eq(icons.id, existing.id));
		console.error("regeneration failed; restored the previous photo");
	} else {
		console.error("regeneration failed");
	}
	process.exit(1);
}

main().catch((error) => {
	console.error(safeError(error));
	process.exit(1);
});
