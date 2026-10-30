"use client";

import { StarterCard, type StarterTile } from "@billing/components/StarterCard";
import { useLocaleRouter } from "@i18n/router";
import { api } from "@shared/lib/api";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

function isUnauthorized(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "UNAUTHORIZED"
	);
}

export function SavedRecipes() {
	const t = useTranslations("home");
	const recipeT = useTranslations("recipe");
	const locale = useLocale();
	const router = useLocaleRouter();
	const [recipes, setRecipes] = useState<
		| {
				recipeId: string;
				title: string;
				image: string | null;
				heroIconUrl: string | null;
				servings: number;
				totalTimeSeconds: number | null;
		  }[]
		| null
	>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;

		void api.recipes
			.listSaved({ locale: locale === "en" ? "en" : "de" })
			.then((result) => {
				if (!cancelled) {
					setRecipes(result);
				}
			})
			.catch((error: unknown) => {
				if (cancelled) {
					return;
				}
				if (isUnauthorized(error)) {
					router.replace(
						`/login?next=${encodeURIComponent("/saved")}`,
					);
					return;
				}
				setFailed(true);
				setRecipes([]);
			});

		return () => {
			cancelled = true;
		};
	}, [locale, router]);

	if (failed) {
		return <p className="text-lg text-destructive">{t("savedFailed")}</p>;
	}

	if (!recipes) {
		return null;
	}

	if (recipes.length === 0) {
		return (
			<p className="text-lg text-muted-foreground">{t("savedEmpty")}</p>
		);
	}

	const tiles: StarterTile[] = recipes.map((recipe) => {
		const minutes =
			recipe.totalTimeSeconds != null && recipe.totalTimeSeconds > 0
				? Math.max(1, Math.round(recipe.totalTimeSeconds / 60))
				: null;
		const meta = [
			minutes != null ? recipeT("minutes", { count: minutes }) : null,
			recipeT("servings", { count: recipe.servings }),
		]
			.filter(Boolean)
			.join(" · ");
		return {
			id: recipe.recipeId,
			href: `/recipes/${recipe.recipeId}`,
			title: recipe.title,
			imageUrl: recipe.image ?? recipe.heroIconUrl,
			meta: meta || null,
		};
	});

	return (
		<ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
			{tiles.map((tile, index) => (
				<li key={tile.id}>
					<StarterCard
						tile={tile}
						loading={index < 4 ? "eager" : "lazy"}
						sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 45vw"
					/>
				</li>
			))}
		</ul>
	);
}
