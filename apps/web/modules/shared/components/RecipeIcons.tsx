"use client";

import { api } from "@shared/lib/api";
import { optimizableImage } from "@shared/lib/optimizable-image";
import Image from "next/image";
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
	const [settled, setSettled] = useState(false);

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
			setSettled(true);

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

	return { recipe, ingredients, labelFor, settled };
}

export function DishImage({
	status,
	url,
	label,
	loading,
	skeleton = false,
	sizes = "(min-width: 1024px) 960px, 100vw",
}: {
	status: IconRecord["status"];
	url?: string | null;
	label: string;
	loading?: "eager" | "lazy";
	skeleton?: boolean;
	sizes?: string;
}) {
	const [shownUrl, setShownUrl] = useState<string | null>(null);
	const ready = status === "ready" && Boolean(url);
	const revealed = Boolean(url) && shownUrl === url;
	const cover = `object-cover ${skeleton ? `transition-opacity duration-300 motion-reduce:transition-none ${revealed ? "opacity-100" : "opacity-0"}` : ""}`;

	function reveal() {
		if (url) {
			setShownUrl(url);
		}
	}

	return (
		<div
			className={`relative aspect-video w-full overflow-hidden rounded-[1.75rem] bg-muted shadow-[0_14px_28px_-18px_rgba(64,68,42,0.7)] ${skeleton && !revealed ? "animate-pulse motion-reduce:animate-none" : ""}`}
			aria-busy={skeleton && !revealed ? true : undefined}
		>
			{ready && url && optimizableImage(url) ? (
				<Image
					src={url}
					alt={label}
					fill
					sizes={sizes}
					className={cover}
					onLoad={reveal}
					{...(loading === "eager"
						? { priority: true }
						: { loading: "lazy" as const })}
				/>
			) : ready ? (
				// biome-ignore lint/performance/noImgElement: this host is outside the image optimizer
				<img
					src={url ?? undefined}
					alt={label}
					loading={loading}
					onLoad={reveal}
					ref={(node) => {
						if (
							url &&
							shownUrl !== url &&
							node?.complete &&
							node.naturalWidth > 0
						) {
							setShownUrl(url);
						}
					}}
					className={`size-full ${cover}`}
				/>
			) : skeleton ? (
				<div className="size-full" role="img" aria-label={label} />
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
