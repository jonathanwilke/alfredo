"use client";

import { api } from "@shared/lib/api";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface IconRecord {
	id: string;
	kind: "ingredient" | "recipe";
	key: string;
	status: "pending" | "ready" | "failed";
	url: string | null;
}

export function useRecipeIcons(recipeId: string) {
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

	return { recipe, ingredients, labelFor };
}

export function DishImage({
	status,
	url,
	label,
}: {
	status: IconRecord["status"];
	url?: string | null;
	label: string;
}) {
	return (
		<div className="relative aspect-video w-full overflow-hidden rounded-[1.75rem] bg-muted shadow-[0_14px_28px_-18px_rgba(64,68,42,0.7)]">
			{status === "ready" && url ? (
				// biome-ignore lint/performance/noImgElement: icon URLs are stored objects, not next/image assets
				<img src={url} alt={label} className="size-full object-cover" />
			) : (
				<div
					className="flex size-full items-center justify-center"
					role="img"
					aria-label={label}
				>
					<span
						className={`block size-24 rounded-full ${status === "failed" ? "bg-destructive/30" : "bg-accent"}`}
					/>
				</div>
			)}
		</div>
	);
}
