import { loadRecipe } from "@repo/api";
import { auth } from "@repo/auth";
import { listRecipeIcons } from "@repo/icons";
import { defaultOgResponse, ogSize, recipeOgResponse } from "@shared/og";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

export const alt = "ulivo";
export const size = ogSize;
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image({
	params,
}: {
	params: Promise<{ locale: string; id: string }>;
}) {
	const { locale, id } = await params;
	const t = await getTranslations({ locale, namespace: "home" });
	const session = await auth.api.getSession({ headers: await headers() });
	const recipe = await loadRecipe({
		recipeId: id,
		locale,
		viewerUserId: session?.user.id ?? null,
	});
	if (!recipe?.isCurated) {
		return defaultOgResponse({
			title: t("title"),
			tagline: t("subtitle"),
		});
	}
	const { recipeIcon } = await listRecipeIcons(id);
	const imageUrl =
		recipeIcon?.status === "ready" ? recipeIcon.storageUrl : null;
	return recipeOgResponse({
		title: recipe.content.title,
		description: recipe.content.description?.trim() || t("subtitle"),
		imageUrl,
	});
}
