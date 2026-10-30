import { loadSharedRecipe, readyDishUrl } from "@repo/api";
import { config, getBaseUrl } from "@repo/config";
import { RecipeOverview } from "@shared/components/RecipeOverview";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string; token: string }>;
}): Promise<Metadata> {
	const { locale, token } = await params;
	const recipe = await loadSharedRecipe({ token, locale });
	const t = await getTranslations({ locale, namespace: "home" });
	const siteTitle = `${config.appName} · ${t("title")}`;
	if (!recipe) {
		return {
			metadataBase: new URL(getBaseUrl()),
			title: siteTitle,
			description: t("subtitle"),
			robots: { index: false, follow: false },
			openGraph: {
				title: siteTitle,
				description: t("subtitle"),
				locale: locale === "de" ? "de_DE" : "en_US",
				type: "website",
			},
			twitter: {
				card: "summary_large_image",
				title: siteTitle,
				description: t("subtitle"),
			},
		};
	}

	const title = `${config.appName} · ${recipe.content.title}`;
	const description = recipe.content.description?.trim() || t("subtitle");
	const path =
		locale === config.i18n.defaultLocale
			? `/r/${token}`
			: `/${locale}/r/${token}`;
	return {
		metadataBase: new URL(getBaseUrl()),
		title,
		description,
		robots: { index: false, follow: false },
		openGraph: {
			title,
			description,
			url: path,
			locale: locale === "de" ? "de_DE" : "en_US",
			type: "article",
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
		},
	};
}

export default async function SharedRecipePage({
	params,
}: {
	params: Promise<{ locale: string; token: string }>;
}) {
	const { locale, token } = await params;
	setRequestLocale(locale);
	const recipe = await loadSharedRecipe({ token, locale });
	if (!recipe) {
		notFound();
	}
	const dishUrl = await readyDishUrl(recipe.recipeId);

	return (
		<RecipeOverview
			recipeId={recipe.recipeId}
			content={recipe.content}
			dishUrl={dishUrl}
			share={{
				mode: "public",
				shared: true,
				path:
					locale === config.i18n.defaultLocale
						? `/r/${token}`
						: `/${locale}/r/${token}`,
			}}
		/>
	);
}
