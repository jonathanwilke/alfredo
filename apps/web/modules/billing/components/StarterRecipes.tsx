import { getTranslations } from "next-intl/server";
import { StarterCarousel } from "./StarterCard";

export async function StarterRecipes({
	recipes,
}: {
	recipes: {
		recipeId: string;
		title: string;
		image: string | null;
		heroIconUrl: string | null;
		servings: number;
		totalTimeSeconds: number | null;
	}[];
}) {
	if (recipes.length === 0) {
		return null;
	}

	const t = await getTranslations("home");
	const recipeT = await getTranslations("recipe");
	const tiles = recipes.map((recipe) => {
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
			imageUrl: recipe.heroIconUrl ?? recipe.image,
			meta: meta || null,
		};
	});

	return (
		<section
			aria-label={t("startersLabel")}
			className="flex flex-col gap-6 py-4"
		>
			<h2 className="text-balance text-center font-heading text-3xl leading-tight sm:text-4xl">
				{t("startersTitle")}
			</h2>
			<StarterCarousel tiles={tiles} />
		</section>
	);
}
