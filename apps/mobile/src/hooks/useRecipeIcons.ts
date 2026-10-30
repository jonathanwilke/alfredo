import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { IconStatus, RecipeIcon } from "@/api/types";
import { useI18n } from "@/i18n";

export function useRecipeIcons(recipeId: string) {
	const { copy } = useI18n();
	const [recipe, setRecipe] = useState<RecipeIcon | null>(null);
	const [ingredients, setIngredients] = useState<RecipeIcon[]>([]);

	useEffect(() => {
		let stopped = false;
		let timer: ReturnType<typeof setTimeout> | undefined;

		async function load() {
			try {
				const result = await api.icons(recipeId);
				if (stopped) {
					return;
				}
				setRecipe(result.recipe);
				setIngredients(result.ingredients);
				const pending = [result.recipe, ...result.ingredients].some(
					(icon) => icon?.status === "pending",
				);
				if (pending) {
					timer = setTimeout(() => {
						void load();
					}, 2000);
				}
			} catch {
				// Icons are decorative. The tiles stay in the pending state.
			}
		}

		void load();
		return () => {
			stopped = true;
			if (timer) {
				clearTimeout(timer);
			}
		};
	}, [recipeId]);

	const labelFor = (status: IconStatus) => {
		if (status === "failed") {
			return copy.home.iconFailed;
		}
		if (status === "ready") {
			return copy.home.iconReady;
		}
		return copy.home.iconPending;
	};

	return { recipe, ingredients, labelFor };
}
