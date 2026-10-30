import { db, icons } from "@repo/database";
import { and, eq } from "drizzle-orm";

export async function readyDishUrl(recipeId: string) {
	const [icon] = await db
		.select({
			status: icons.status,
			storageUrl: icons.storageUrl,
		})
		.from(icons)
		.where(and(eq(icons.kind, "recipe"), eq(icons.key, recipeId)))
		.limit(1);
	if (icon?.status === "ready" && icon.storageUrl) {
		return icon.storageUrl;
	}
	return null;
}
