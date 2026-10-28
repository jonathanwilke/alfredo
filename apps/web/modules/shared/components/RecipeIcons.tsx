"use client";

import { api } from "@shared/lib/api";
import { Button } from "@ui/components/button";
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
	const [failed, setFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let stopped = false;
		let timer = 0;

		async function load() {
			if (document.visibilityState === "hidden") {
				timer = window.setTimeout(() => {
					void load();
				}, 2000);
				return;
			}

			try {
				const result = await api.icons.list({ recipeId });
				if (stopped) {
					return;
				}

				setFailed(false);
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
			} catch {
				if (!stopped) {
					setFailed(true);
				}
			}
		}

		void load();

		return () => {
			stopped = true;
			window.clearTimeout(timer);
		};
	}, [recipeId, attempt]);

	const labelFor = (icon: IconRecord) => {
		const name = icon.key.replaceAll("-", " ");
		if (icon.status === "failed") {
			return `${name}. ${t("iconFailed")}`;
		}
		if (icon.status === "ready") {
			return name;
		}
		return `${name}. ${t("iconPending")}`;
	};

	if (failed) {
		return (
			<div className="flex flex-wrap items-center gap-3">
				<p
					role="alert"
					className="text-base text-pretty text-destructive"
				>
					{t("iconError")}
				</p>
				<Button
					type="button"
					variant="outline"
					onClick={() => setAttempt((value) => value + 1)}
				>
					{t("iconRetry")}
				</Button>
			</div>
		);
	}

	return (
		<div className="flex min-w-0 flex-wrap items-end gap-3">
			<IconTile
				size="hero"
				status={recipe?.status ?? "pending"}
				url={recipe?.url}
				label={recipe ? labelFor(recipe) : t("iconPending")}
			/>
			<div className="flex min-w-0 flex-wrap gap-2">
				{ingredients.map((icon) => (
					<IconTile
						key={icon.id}
						status={icon.status}
						url={icon.url}
						label={labelFor(icon)}
					/>
				))}
			</div>
		</div>
	);
}
