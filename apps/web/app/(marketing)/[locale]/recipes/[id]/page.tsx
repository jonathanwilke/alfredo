import { ensureRecipeDescription, loadRecipe } from "@repo/api";
import { auth } from "@repo/auth";
import { config, getBaseUrl } from "@repo/config";
import { RecipeOverview } from "@shared/components/RecipeOverview";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

async function viewerId() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	return session?.user.id ?? null;
}

async function readableRecipe(locale: string, id: string) {
	return loadRecipe({
		recipeId: id,
		locale,
		viewerUserId: await viewerId(),
	});
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
	const { locale, id } = await params;
	const recipe = await readableRecipe(locale, id);
	const t = await getTranslations({ locale, namespace: "home" });
	const base = getBaseUrl();
	const siteTitle = `${config.appName} · ${t("title")}`;
	const localeName = locale === "de" ? "de_DE" : "en_US";
	if (!recipe?.isCurated) {
		return {
			metadataBase: new URL(base),
			title: recipe
				? `${config.appName} · ${recipe.content.title}`
				: siteTitle,
			description: t("subtitle"),
			robots: { index: false, follow: false },
			openGraph: {
				title: siteTitle,
				description: t("subtitle"),
				locale: localeName,
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
		locale === "de" ? `/recipes/${id}` : `/${locale}/recipes/${id}`;
	return {
		metadataBase: new URL(base),
		title,
		description,
		robots: { index: true, follow: true },
		openGraph: {
			title,
			description,
			url: path,
			locale: localeName,
			type: "article",
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
		},
	};
}

export default async function RecipePage({
	params,
	searchParams,
}: {
	params: Promise<{ locale: string; id: string }>;
	searchParams: Promise<{ cook?: string }>;
}) {
	const { locale, id } = await params;
	const { cook } = await searchParams;
	setRequestLocale(locale);
	const loaded = await readableRecipe(locale, id);

	if (!loaded) {
		notFound();
	}

	const recipe = await ensureRecipeDescription(loaded, locale);
	const t = await getTranslations("recipe");
	const notice =
		recipe.isCurated && recipe.servedLocale !== locale
			? t(recipe.servedLocale === "de" ? "curatedDe" : "curatedEn")
			: null;

	return (
		<RecipeOverview
			recipeId={recipe.recipeId}
			content={recipe.content}
			notice={notice}
			startCooking={cook === "1"}
			share={{
				mode: recipe.isCurated ? "public" : "owner",
				shared: recipe.shared ?? false,
				path:
					locale === "de"
						? `/recipes/${recipe.recipeId}`
						: `/${locale}/recipes/${recipe.recipeId}`,
			}}
		/>
	);
}
