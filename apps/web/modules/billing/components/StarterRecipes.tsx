import { LocaleLink } from "@i18n/routing";
import { getTranslations } from "next-intl/server";

export async function StarterRecipes({
	recipes,
}: {
	recipes: { recipeId: string; title: string }[];
}) {
	if (recipes.length === 0) {
		return null;
	}

	const t = await getTranslations("home");

	return (
		<nav aria-label={t("startersLabel")} className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<h2 className="text-balance text-3xl leading-tight">
					{t("startersTitle")}
				</h2>
				<p className="max-w-[42ch] text-lg leading-relaxed text-muted-foreground">
					{t("startersBody")}
				</p>
			</div>
			<ul className="flex flex-col">
				{recipes.map((recipe) => (
					<li key={recipe.recipeId} className="min-w-0">
						<LocaleLink
							href={`/recipes/${recipe.recipeId}`}
							className="flex min-h-12 items-center text-lg text-foreground underline-offset-4 hover:underline"
						>
							{recipe.title}
						</LocaleLink>
					</li>
				))}
			</ul>
		</nav>
	);
}
