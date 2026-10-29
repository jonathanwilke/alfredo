"use client";

import { LocaleLink, useLocaleRouter } from "@i18n/routing";
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
	const locale = useLocale();
	const router = useLocaleRouter();
	const [recipes, setRecipes] = useState<
		{ recipeId: string; title: string }[] | null
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

	return (
		<ul className="flex flex-col gap-3">
			{recipes.map((recipe) => (
				<li key={recipe.recipeId}>
					<LocaleLink
						href={`/recipes/${recipe.recipeId}`}
						className="text-lg text-foreground no-underline hover:underline"
					>
						{recipe.title}
					</LocaleLink>
				</li>
			))}
		</ul>
	);
}
