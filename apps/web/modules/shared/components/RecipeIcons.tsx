"use client";

import { api } from "@shared/lib/api";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { IconTile } from "./IconTile";

interface IconRecord {
	id: string;
	kind: "ingredient" | "recipe";
	key: string;
	status: "pending" | "ready" | "failed";
	url: string | null;
}

export function RecipeIcons({ recipeId }: { recipeId: string }) {
	const t = useTranslations("home");
	const [recipe, setRecipe] = useState<IconRecord | null>(null);
	const [ingredients, setIngredients] = useState<IconRecord[]>([]);

	useEffect(() => {
		let stopped = false;
		let timer = 0;

		async function load() {
			const result = await api.icons.list({ recipeId });
			if (stopped) {
				return;
			}

			setRecipe(result.recipe);
			setIngredients(result.ingredients);

			const pending = [result.recipe, ...result.ingredients].some(
				(icon) => icon?.status === "pending",
			);

			if (pending) {
				timer = window.setTimeout(() => {
					void load();
				}, 2000);
			}
		}

		void load();

		return () => {
			stopped = true;
			window.clearTimeout(timer);
		};
	}, [recipeId]);

	const labelFor = (status: IconRecord["status"]) => {
		if (status === "failed") {
			return t("iconFailed");
		}
		if (status === "ready") {
			return t("iconReady");
		}
		return t("iconPending");
	};

	return (
		<div className="flex items-end gap-3">
			<IconTile
				size="hero"
				status={recipe?.status ?? "pending"}
				url={recipe?.url}
				label={labelFor(recipe?.status ?? "pending")}
			/>
			<div className="flex gap-2">
				{ingredients.map((icon) => (
					<IconTile
						key={icon.id}
						status={icon.status}
						url={icon.url}
						label={labelFor(icon.status)}
					/>
				))}
			</div>
		</div>
	);
}
