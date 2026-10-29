import { ensureRecipeDescription, loadRecipe } from "@repo/api";
import { config } from "@repo/config";
import { RecipeOverview } from "@shared/components/RecipeOverview";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
	const { locale, id } = await params;
	const recipe = await loadRecipe({ recipeId: id, locale });
	const t = await getTranslations({ locale, namespace: "home" });

	return {
		title: recipe
			? `${config.appName} · ${recipe.content.title}`
			: `${config.appName} · ${t("title")}`,
	};
}

export default async function RecipePage({
	params,
}: {
	params: Promise<{ locale: string; id: string }>;
}) {
	const { locale, id } = await params;
	setRequestLocale(locale);
	const loaded = await loadRecipe({ recipeId: id, locale });

	if (!loaded) {
		notFound();
	}

	const recipe = await ensureRecipeDescription(loaded, locale);

	return (
		<RecipeOverview recipeId={recipe.recipeId} content={recipe.content} />
	);
}
