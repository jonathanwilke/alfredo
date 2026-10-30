import { loadSharedRecipe } from "@repo/api";
import { listRecipeIcons } from "@repo/icons";
import { defaultOgResponse, ogSize, recipeOgResponse } from "@shared/og";
import { getTranslations } from "next-intl/server";

export const alt = "ulivo";
export const size = ogSize;
export const contentType = "image/png";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Image({
	params,
}: {
	params: Promise<{ locale: string; token: string }>;
}) {
	const { locale, token } = await params;
	const t = await getTranslations({ locale, namespace: "home" });
	const recipe = await loadSharedRecipe({ token, locale });
	if (!recipe) {
		return defaultOgResponse({
			title: t("title"),
			tagline: t("subtitle"),
		});
	}
	const { recipeIcon } = await listRecipeIcons(recipe.recipeId);
	const imageUrl =
		recipeIcon?.status === "ready" ? recipeIcon.storageUrl : null;
	return recipeOgResponse({
		title: recipe.content.title,
		description: recipe.content.description?.trim() || t("subtitle"),
		imageUrl,
	});
}
