"use client";

import { LocaleLink } from "@i18n/routing";
import { ThemeToggle } from "@shared/components/ThemeToggle";
import { Button } from "@ui/components/button";
import { ChefHat, CookingPot, Utensils } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { CookingGuide } from "./CookingGuide";
import { ingredientIconKey } from "./highlight-step";
import { IconTile } from "./IconTile";
import {
	formatAmount,
	presentIngredient,
	scaleMeasure,
} from "./ingredient-amount";
import { LoginButton } from "./LoginButton";
import { DishImage, useRecipeIcons } from "./RecipeIcons";
import { SaveRecipeButton } from "./SaveRecipeButton";
import { Wordmark } from "./Wordmark";

interface RecipeContent {
	title: string;
	description?: string;
	servings: number;
	prepTimeSeconds: number | null;
	cookTimeSeconds: number | null;
	ingredients: {
		id: string;
		name: string;
		canonicalKey?: string;
		quantity: number | null;
		unit: string | null;
		form?: string | null;
	}[];
	steps: {
		id: string;
		text: string;
		ingredientIds: string[];
		timerSeconds?: number | null;
	}[];
}

function formatMinutes(seconds: number | null) {
	if (seconds == null || seconds <= 0) {
		return null;
	}
	return Math.max(1, Math.round(seconds / 60));
}

export function RecipeOverview({
	recipeId,
	content,
}: {
	recipeId: string;
	content: RecipeContent;
}) {
	const t = useTranslations("recipe");
	const locale = useLocale();
	const [servings, setServings] = useState(content.servings);
	const [cooking, setCooking] = useState(false);
	const factor = content.servings > 0 ? servings / content.servings : 1;
	const maxServings = Math.max(12, Math.ceil(content.servings * 3));
	const prep = formatMinutes(content.prepTimeSeconds);
	const cook = formatMinutes(content.cookTimeSeconds);
	const ingredientsById = new Map(
		content.ingredients.map((ingredient) => [ingredient.id, ingredient]),
	);
	const description = content.description?.trim();
	const {
		recipe: dish,
		ingredients: dishIngredients,
		labelFor,
	} = useRecipeIcons(recipeId);
	const iconsByKey = new Map(dishIngredients.map((icon) => [icon.key, icon]));

	if (cooking) {
		return (
			<CookingGuide
				recipeId={recipeId}
				onExit={() => setCooking(false)}
				steps={content.steps.map((step) => ({
					id: step.id,
					text: step.text,
					timerSeconds: step.timerSeconds ?? null,
					ingredients: step.ingredientIds.flatMap((id) => {
						const ingredient = ingredientsById.get(id);
						if (!ingredient) {
							return [];
						}
						const scaled =
							ingredient.quantity == null
								? null
								: scaleMeasure(
										ingredient.quantity * factor,
										ingredient.unit,
										locale,
									);
						return [
							{
								id: ingredient.id,
								name: ingredient.name,
								quantity: ingredient.quantity,
								unit: ingredient.unit,
								scaledQuantity: scaled?.quantity ?? null,
								scaledUnit: scaled?.unitChanged
									? scaled.unit
									: null,
								canonicalKey: ingredient.canonicalKey ?? null,
							},
						];
					}),
				}))}
			/>
		);
	}

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-5 py-8 sm:px-8">
			<header className="flex items-center justify-between gap-4">
				<LocaleLink href="/" className="text-foreground no-underline">
					<Wordmark />
				</LocaleLink>
				<div className="flex items-center gap-2">
					<LoginButton />
					<ThemeToggle />
				</div>
			</header>
			<article className="flex flex-col gap-10 pb-16">
				<div className="flex flex-col gap-4">
					<h1 className="text-balance text-5xl leading-[1.05] font-semibold tracking-tight">
						{content.title}
					</h1>
					{description ? (
						<p className="text-lg leading-relaxed">{description}</p>
					) : null}
					{prep || cook ? (
						<div className="flex flex-wrap gap-x-6 gap-y-2 text-lg text-muted-foreground">
							{prep ? (
								<p className="flex items-center gap-2">
									<Utensils
										className="size-5 shrink-0"
										aria-hidden
									/>
									<span>
										{t("prep")}{" "}
										{t("minutes", { count: prep })}
									</span>
								</p>
							) : null}
							{cook ? (
								<p className="flex items-center gap-2">
									<CookingPot
										className="size-5 shrink-0"
										aria-hidden
									/>
									<span>
										{t("cook")}{" "}
										{t("minutes", { count: cook })}
									</span>
								</p>
							) : null}
						</div>
					) : null}
				</div>
				<SaveRecipeButton recipeId={recipeId}>
					{content.steps.length > 0 ? (
						<Button
							type="button"
							variant="primary"
							onClick={() => setCooking(true)}
							className="order-first h-12 rounded-full bg-accent px-8 text-lg text-accent-foreground shadow-none hover:bg-accent/90 [&>svg]:opacity-100"
						>
							<ChefHat aria-hidden className="size-5" />
							{t("start")}
						</Button>
					) : null}
				</SaveRecipeButton>
				<DishImage
					status={dish?.status ?? "pending"}
					url={dish?.url}
					label={labelFor(dish?.status ?? "pending")}
				/>
				<div className="flex max-w-sm flex-col gap-3">
					<label htmlFor="servings" className="text-lg font-semibold">
						{t("servings", { count: servings })}
					</label>
					<input
						id="servings"
						type="range"
						min={1}
						max={maxServings}
						step={1}
						value={servings}
						onChange={(event) =>
							setServings(Number(event.target.value))
						}
						className="accent-primary"
					/>
				</div>
				<section className="flex flex-col gap-4">
					<h2 className="text-3xl font-semibold tracking-tight">
						{t("ingredients")}
					</h2>
					<ul className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
						{content.ingredients.map((ingredient) => {
							const presented = presentIngredient(ingredient);
							const amount =
								ingredient.quantity == null
									? null
									: formatAmount(
											ingredient.quantity * factor,
											ingredient.unit,
											locale,
										);
							const detail = [amount, presented.form]
								.filter(Boolean)
								.join(", ");
							const iconKey = ingredient.canonicalKey
								? ingredientIconKey(ingredient.canonicalKey)
								: null;
							const icon = iconKey
								? iconsByKey.get(iconKey)
								: undefined;

							return (
								<li
									key={ingredient.id}
									className="flex items-center gap-3"
								>
									<IconTile
										status={icon?.status ?? "pending"}
										url={icon?.url}
										label={labelFor(
											icon?.status ?? "pending",
										)}
										decorative
									/>
									<span className="flex min-w-0 flex-col">
										<span className="text-lg leading-snug">
											{presented.name}
										</span>
										{detail ? (
											<span className="text-base leading-snug text-muted-foreground">
												{detail}
											</span>
										) : null}
									</span>
								</li>
							);
						})}
					</ul>
				</section>
			</article>
		</main>
	);
}
