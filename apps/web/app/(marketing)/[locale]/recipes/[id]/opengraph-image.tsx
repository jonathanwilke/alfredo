import { loadRecipe, readyDishUrl } from "@repo/api";
import { defaultOgResponse, ogSize, recipeOgResponse } from "@shared/og";
import { getTranslations } from "next-intl/server";

export const alt = "ulivo";
export const size = ogSize;
export const contentType = "image/png";
export const runtime = "nodejs";
export const dynamic = "force-static";
export const revalidate = 3600;

export default async function Image({
	params,
}: {
	params: Promise<{ locale: string; id: string }>;
}) {
	const { locale, id } = await params;
	const t = await getTranslations({ locale, namespace: "home" });
	const recipe = await loadRecipe({
		recipeId: id,
		locale,
		viewerUserId: null,
	});
	if (!recipe?.isCurated) {
		return defaultOgResponse({
			title: t("title"),
			tagline: t("subtitle"),
		});
	}
	const imageUrl = await readyDishUrl(id);
	return recipeOgResponse({
		title: recipe.content.title,
		description: recipe.content.description?.trim() || t("subtitle"),
		imageUrl,
	});
}
