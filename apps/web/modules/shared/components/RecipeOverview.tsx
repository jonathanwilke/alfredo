"use client";

import { Pot01Icon, SpoonIcon } from "@hugeicons/core-free-icons";
import { LocaleLink } from "@i18n/routing";
import { resolveStepUses, stepIngredientLine } from "@repo/cooking";
import { track } from "@shared/lib/analytics";
import { Button } from "@ui/components/button";
import { useLocale, useTranslations } from "next-intl";
import { parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState } from "react";
import { CookingGuide } from "./CookingGuide";
import { ingredientIconKey } from "./highlight-step";
import { Icon } from "./Icon";
import { IconTile } from "./IconTile";
import {
	formatAmount,
	presentIngredient,
	scaleMeasure,
} from "./ingredient-amount";
import { LoginButton } from "./LoginButton";
import { DishImage, useRecipeIcons } from "./RecipeIcons";
import { SaveRecipeButton } from "./SaveRecipeButton";
import { ShareRecipeButton } from "./ShareRecipeButton";
import { SiteFooter } from "./SiteFooter";
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
		uses?: {
			ingredientId: string;
			quantity?: number | null;
			unit?: string | null;
		}[];
		timerSeconds?: number | null;
	}[];
}

function formatMinutes(seconds: number | null) {
	if (seconds == null || seconds <= 0) {
		return null;
	}
	return Math.max(1, Math.round(seconds / 60));
}

const cookingQuery = {
	cook: parseAsStringLiteral(["1"]),
	step: parseAsInteger,
};

export function RecipeOverview(props: {
	recipeId: string;
	content: RecipeContent;
	notice?: string | null;
	dishUrl?: string | null;
	share?: {
		mode: "public" | "owner";
		shared: boolean;
		path?: string;
	};
}) {
	return (
		<NuqsAdapter>
			<RecipeOverviewContent {...props} />
		</NuqsAdapter>
	);
}

function RecipeOverviewContent({
	recipeId,
	content,
	notice,
	share,
	dishUrl = null,
}: {
	recipeId: string;
	content: RecipeContent;
	notice?: string | null;
	dishUrl?: string | null;
	share?: {
		mode: "public" | "owner";
		shared: boolean;
		path?: string;
	};
}) {
	const t = useTranslations("recipe");
	const locale = useLocale();
	const [servings, setServings] = useState(content.servings);
	const [{ cook: cookingParam }, setCookingQuery] = useQueryStates(
		cookingQuery,
		{ history: "replace" },
	);
	const cooking = cookingParam === "1" && content.steps.length > 0;
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
		settled,
	} = useRecipeIcons(recipeId);
	const iconsByKey = new Map(dishIngredients.map((icon) => [icon.key, icon]));
	const photo =
		dish?.status === "ready" && dish.url
			? dish.url
			: !settled
				? dishUrl
				: null;

	if (cooking) {
		return (
			<CookingGuide
				title={content.title}
				imageUrl={photo}
				onExit={() => {
					void setCookingQuery({ cook: null, step: null });
				}}
				steps={content.steps.map((step) => ({
					id: step.id,
					text: step.text,
					line: stepIngredientLine({
						ingredients: content.ingredients,
						step,
						factor,
						format: (quantity, unit) =>
							formatAmount(quantity, unit, locale),
					}),
					timerSeconds: step.timerSeconds ?? null,
					ingredients: resolveStepUses(
						step,
						content.ingredients,
					).flatMap((use) => {
						const ingredient = ingredientsById.get(
							use.ingredientId,
						);
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
			<header className="flex flex-wrap items-center justify-between gap-3">
				<LocaleLink href="/" className="text-foreground no-underline">
					<Wordmark />
				</LocaleLink>
				<div className="flex flex-wrap items-center justify-end gap-2">
					<LoginButton />
				</div>
			</header>
			<article className="flex flex-col gap-10 pb-16">
				<div
					className={
						photo || !settled || dish?.status === "pending"
							? "grid items-center gap-8 lg:grid-cols-2 lg:gap-12"
							: undefined
					}
				>
					{photo || !settled || dish?.status === "pending" ? (
						<div className="lg:order-2">
							<DishImage
								status={
									photo
										? "ready"
										: (dish?.status ?? "pending")
								}
								url={photo}
								label={labelFor(
									photo
										? "ready"
										: (dish?.status ?? "pending"),
								)}
								loading="eager"
								skeleton
								sizes="(min-width: 1024px) 40vw, 100vw"
							/>
						</div>
					) : null}
					<div className="flex flex-col gap-4 lg:order-1">
						<h1 className="text-balance text-5xl leading-[1.05] font-semibold tracking-tight">
							{content.title}
						</h1>
						{description ? (
							<p className="text-lg leading-relaxed">
								{description}
							</p>
						) : null}
						{notice ? (
							<p className="max-w-[42ch] text-lg leading-relaxed text-muted-foreground">
								{notice}
							</p>
						) : null}
						{prep || cook ? (
							<div className="flex flex-wrap gap-x-6 gap-y-2 text-lg text-muted-foreground">
								{prep ? (
									<p className="flex items-center gap-2">
										<Icon
											icon={SpoonIcon}
											className="shrink-0"
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
										<Icon
											icon={Pot01Icon}
											className="shrink-0"
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
				</div>
				<SaveRecipeButton recipeId={recipeId}>
					{content.steps.length > 0 ? (
						<Button
							type="button"
							variant="primary"
							onClick={() => {
								track("CookingStarted", { source: "recipe" });
								void setCookingQuery({ cook: "1", step: null });
							}}
							className="order-first h-12 rounded-full bg-accent px-8 text-lg text-accent-foreground shadow-none hover:bg-accent/90 [&>svg]:opacity-100"
						>
							<Icon icon={SpoonIcon} aria-hidden />
							{t("start")}
						</Button>
					) : null}
					{share ? (
						<ShareRecipeButton
							recipeId={recipeId}
							title={content.title}
							text={description ?? content.title}
							locale={locale === "en" ? "en" : "de"}
							mode={share.mode}
							path={share.path}
							shared={share.shared}
							labels={{
								share: t("share"),
								stopSharing: t("stopSharing"),
								linkCopied: t("linkCopied"),
								shareFailed: t("shareFailed"),
							}}
						/>
					) : null}
				</SaveRecipeButton>
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
				{content.steps.length > 0 ? (
					<section className="flex flex-col gap-6">
						<h2 className="text-3xl font-semibold tracking-tight">
							{t("steps")}
						</h2>
						<ol className="flex flex-col gap-6">
							{content.steps.map((step, index) => {
								const line = stepIngredientLine({
									ingredients: content.ingredients,
									step,
									factor,
									format: (quantity, unit) =>
										formatAmount(quantity, unit, locale),
								});
								return (
									<li key={step.id} className="flex min-w-0 flex-col">
										<h3 className="font-sans text-[13px] font-semibold tracking-[0.14em] uppercase">
											{t("stepLabel", {
												step: index + 1,
											})}
										</h3>
										{line ? (
											<p
												title={line}
												className="mt-1 truncate text-sm text-muted-foreground"
											>
												{line}
											</p>
										) : null}
										<p className="mt-2 text-lg leading-relaxed">
											{step.text}
										</p>
									</li>
								);
							})}
						</ol>
					</section>
				) : null}
			</article>
			<SiteFooter />
		</main>
	);
}
