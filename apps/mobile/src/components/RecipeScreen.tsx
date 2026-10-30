import Slider from "@react-native-community/slider";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
	Bookmark,
	BookmarkCheck,
	ChefHat,
	CookingPot,
	Utensils,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Platform,
	Pressable,
	ScrollView,
	Share,
	Text,
	View,
} from "react-native";
import { ApiError, api, apiCode } from "@/api/client";
import type { StoredRecipe } from "@/api/types";
import { authClient } from "@/auth/client";
import { siteOrigin } from "@/auth/origin";
import { useRecipeIcons } from "@/hooks/useRecipeIcons";
import { useI18n } from "@/i18n";
import { ingredientIconKey, type StepIngredient } from "@/lib/highlight-step";
import {
	formatAmount,
	presentIngredient,
	scaleMeasure,
} from "@/lib/ingredient-amount";
import { useLayout } from "@/lib/layout";
import { oneParam } from "@/lib/params";
import { useTheme } from "@/theme/theme";
import { fonts } from "@/theme/tokens";
import { Footer, Header } from "./Chrome";
import { CookingMode, type CookingStep } from "./CookingMode";
import { DishImage, IconTile } from "./IconTile";
import { Body, Button, Display, Field, Notice, Screen } from "./ui";

function minutes(seconds: number | null) {
	if (seconds == null || seconds <= 0) {
		return null;
	}
	return Math.max(1, Math.round(seconds / 60));
}

export function RecipeScreen({ recipeId }: { recipeId: string }) {
	const { locale, copy } = useI18n();
	const params = useLocalSearchParams<{ save?: string }>();
	const saveFlag = oneParam(params.save);
	const [recipe, setRecipe] = useState<StoredRecipe | null | undefined>(
		undefined,
	);
	const [failed, setFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setFailed(false);
		setRecipe(undefined);
		void api
			.recipe(recipeId, locale)
			.then((result) => {
				if (!cancelled) {
					setRecipe(result);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setFailed(true);
					setRecipe(null);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [recipeId, locale, attempt]);

	if (failed) {
		return (
			<Screen>
				<Header />
				<View style={{ padding: 20, gap: 16 }}>
					<Notice tone="danger">{copy.recipe.loadFailed}</Notice>
					<Button
						label={copy.recipe.retry}
						onPress={() => setAttempt((value) => value + 1)}
					/>
				</View>
			</Screen>
		);
	}

	if (recipe === undefined) {
		return (
			<Screen>
				<Header />
				<ActivityIndicator style={{ marginTop: 48 }} />
			</Screen>
		);
	}

	if (!recipe) {
		return (
			<Screen>
				<Header />
				<View style={{ padding: 20 }}>
					<Body>{copy.recipe.missing}</Body>
				</View>
			</Screen>
		);
	}

	return <RecipeBody recipe={recipe} saveFlag={saveFlag === "1"} />;
}

function RecipeBody({
	recipe,
	saveFlag,
}: {
	recipe: StoredRecipe;
	saveFlag: boolean;
}) {
	const { locale, copy } = useI18n();
	const { colors } = useTheme();
	const layout = useLayout();
	const router = useRouter();
	const { data: session } = authClient.useSession();
	const content = recipe.content;
	const [servings, setServings] = useState(content.servings);
	const [cooking, setCooking] = useState(false);
	const [saved, setSaved] = useState(false);
	const [shared, setShared] = useState(recipe.shared ?? false);
	const [pending, setPending] = useState(false);
	const [needsSignIn, setNeedsSignIn] = useState(false);
	const [email, setEmail] = useState("");
	const [notice, setNotice] = useState<string | null>(null);
	const icons = useRecipeIcons(recipe.recipeId);
	const factor = content.servings > 0 ? servings / content.servings : 1;
	const maxServings = Math.max(12, Math.ceil(content.servings * 3));
	const prep = minutes(content.prepTimeSeconds);
	const cook = minutes(content.cookTimeSeconds);
	const prepLabel = prep
		? `${copy.recipe.prep} ${copy.recipe.minutes(prep)}`
		: null;
	const cookLabel = cook
		? `${copy.recipe.cook} ${copy.recipe.minutes(cook)}`
		: null;
	const description = content.description?.trim();
	const localeNotice =
		recipe.isCurated && recipe.servedLocale !== locale
			? copy.recipe.curated(recipe.servedLocale)
			: null;
	const iconsByKey = new Map(
		icons.ingredients.map((icon) => [icon.key, icon]),
	);

	useEffect(() => {
		let cancelled = false;
		void api
			.recipeSaved(recipe.recipeId)
			.then((value) => {
				if (!cancelled) {
					setSaved(value);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setNotice(copy.recipe.saveFailed);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [recipe.recipeId, copy.recipe.saveFailed]);

	useEffect(() => {
		if (!saveFlag || !session) {
			return;
		}
		let cancelled = false;
		void api
			.saveRecipe(recipe.recipeId)
			.then(() => {
				if (!cancelled) {
					setSaved(true);
					setNeedsSignIn(false);
					router.setParams({ save: "" });
				}
			})
			.catch((error: unknown) => {
				if (cancelled) {
					return;
				}
				setNeedsSignIn(apiCode(error) === "UNAUTHORIZED");
				if (apiCode(error) !== "UNAUTHORIZED") {
					setNotice(copy.recipe.saveFailed);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [saveFlag, session, recipe.recipeId, router, copy.recipe.saveFailed]);

	async function persist(nextSaved: boolean) {
		setPending(true);
		setNotice(null);
		try {
			if (nextSaved) {
				await api.saveRecipe(recipe.recipeId);
			} else {
				await api.unsaveRecipe(recipe.recipeId);
			}
			setSaved(nextSaved);
			setNeedsSignIn(false);
		} catch (error) {
			if (apiCode(error) === "UNAUTHORIZED") {
				setNeedsSignIn(true);
			} else {
				setNotice(copy.recipe.saveFailed);
			}
		} finally {
			setPending(false);
		}
	}

	async function sendLink() {
		const address = email.trim();
		if (!address) {
			return;
		}
		setPending(true);
		setNotice(null);
		const { error } = await authClient.signIn.magicLink({
			email: address,
			callbackURL: `/recipes/${recipe.recipeId}?save=1`,
		});
		setPending(false);
		setNotice(error ? copy.recipe.saveFailed : copy.recipe.saveSent);
	}

	const steps: CookingStep[] = content.steps.map((step) => ({
		id: step.id,
		text: step.text,
		timerSeconds: step.timerSeconds ?? null,
		ingredients: step.ingredientIds.flatMap((id) => {
			const ingredient = content.ingredients.find(
				(item) => item.id === id,
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
			const row: StepIngredient = {
				id: ingredient.id,
				name: ingredient.name,
				quantity: ingredient.quantity,
				unit: ingredient.unit,
				scaledQuantity: scaled?.quantity ?? null,
				scaledUnit: scaled?.unitChanged ? scaled.unit : null,
				canonicalKey: ingredient.canonicalKey ?? null,
			};
			return [row];
		}),
	}));

	if (cooking) {
		return (
			<>
				<StatusBar style="light" />
				<CookingMode steps={steps} onExit={() => setCooking(false)} />
			</>
		);
	}

	async function shareRecipe() {
		setPending(true);
		setNotice(null);
		try {
			const owner = recipe.isOwner ?? !recipe.isCurated;
			const path = recipe.isCurated
				? locale === "de"
					? `/recipes/${recipe.recipeId}`
					: `/${locale}/recipes/${recipe.recipeId}`
				: owner
					? (await api.enableShare(recipe.recipeId, locale)).path
					: null;
			if (!path) {
				throw new Error("share");
			}
			const url = `${siteOrigin}${path}`;
			if (owner && !recipe.isCurated) {
				setShared(true);
			}
			await Share.share({
				title: content.title,
				message:
					Platform.OS === "android"
						? `${content.title}\n${url}`
						: content.title,
				url,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : "";
			if (/cancel|dismiss|did not share/i.test(message)) {
				return;
			}
			setNotice(copy.recipe.shareFailed);
		} finally {
			setPending(false);
		}
	}

	async function stopSharing() {
		setPending(true);
		try {
			await api.disableShare(recipe.recipeId);
			setShared(false);
		} catch {
			setNotice(copy.recipe.shareFailed);
		} finally {
			setPending(false);
		}
	}

	const recipeIcon = icons.recipe;
	const dishPhoto =
		recipeIcon?.status === "ready" && recipeIcon.url ? (
			<DishImage
				status="ready"
				url={recipeIcon.url}
				label={icons.labelFor("ready")}
			/>
		) : null;

	const meta = (
		<View style={{ gap: 16 }}>
			<Display size={layout.isTablet ? 56 : 40}>{content.title}</Display>
			{description ? <Body>{description}</Body> : null}
			{localeNotice ? <Body muted>{localeNotice}</Body> : null}
			{prep || cook ? (
				<View
					style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}
				>
					{prep ? (
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 8,
							}}
						>
							<Utensils
								color={colors.mutedForeground}
								size={20}
							/>
							<Body muted>{prepLabel}</Body>
						</View>
					) : null}
					{cook ? (
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 8,
							}}
						>
							<CookingPot
								color={colors.mutedForeground}
								size={20}
							/>
							<Body muted>{cookLabel}</Body>
						</View>
					) : null}
				</View>
			) : null}
			<View style={{ gap: 12 }}>
				<View
					style={{
						flexDirection: layout.split ? "row" : "column",
						gap: 12,
						alignItems: layout.split ? "center" : "stretch",
					}}
				>
					{content.steps.length > 0 ? (
						<Button
							label={copy.recipe.start}
							icon={
								<ChefHat
									color={colors.accentForeground}
									size={20}
								/>
							}
							onPress={() => setCooking(true)}
						/>
					) : null}
					<Button
						label={copy.recipe.share}
						variant="ghost"
						loading={pending}
						onPress={() => void shareRecipe()}
					/>
					{shared && !recipe.isCurated ? (
						<Button
							label={copy.recipe.stopSharing}
							variant="ghost"
							loading={pending}
							onPress={() => void stopSharing()}
						/>
					) : null}
					<Button
						label={saved ? copy.recipe.saved : copy.recipe.save}
						variant="ghost"
						loading={pending && !needsSignIn}
						icon={
							saved ? (
								<BookmarkCheck
									color={colors.foreground}
									size={20}
								/>
							) : (
								<Bookmark color={colors.foreground} size={20} />
							)
						}
						onPress={() => void persist(!saved)}
					/>
				</View>
				{needsSignIn ? (
					<View
						style={{
							flexDirection: layout.split ? "row" : "column",
							gap: 12,
						}}
					>
						<Field
							label={copy.recipe.saveEmail}
							value={email}
							onChangeText={setEmail}
							keyboardType="email-address"
							autoComplete="email"
							placeholder={copy.recipe.saveEmail}
						/>
						<Button
							label={copy.recipe.saveSend}
							loading={pending}
							onPress={() => void sendLink()}
						/>
					</View>
				) : null}
				{notice ? <Notice>{notice}</Notice> : null}
			</View>
		</View>
	);

	const ingredients = (
		<View style={{ gap: 16 }}>
			<Display size={layout.isTablet ? 36 : 30}>
				{copy.recipe.ingredients}
			</Display>
			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					rowGap: 20,
					columnGap: 16,
				}}
			>
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
					const icon = iconKey ? iconsByKey.get(iconKey) : undefined;
					const basis =
						layout.ingredientColumns === 1
							? "100%"
							: layout.ingredientColumns === 2
								? "47%"
								: "31%";
					return (
						<View
							key={ingredient.id}
							style={{
								flexBasis: basis,
								flexGrow: 1,
								flexDirection: "row",
								alignItems: "center",
								gap: 12,
							}}
						>
							<IconTile
								status={icon?.status ?? "pending"}
								url={icon?.url}
								label={icons.labelFor(
									icon?.status ?? "pending",
								)}
							/>
							<View style={{ flex: 1 }}>
								<Body>{presented.name}</Body>
								{detail ? (
									<Body muted size={16}>
										{detail}
									</Body>
								) : null}
							</View>
						</View>
					);
				})}
			</View>
		</View>
	);

	return (
		<Screen>
			<Header />
			<ScrollView
				contentContainerStyle={{
					paddingHorizontal: layout.pagePadding,
					paddingBottom: 24,
					gap: 28,
					width: "100%",
					maxWidth: layout.split ? 1120 : 960,
					alignSelf: "center",
				}}
			>
				{layout.split ? (
					<View
						style={{
							flexDirection: "row",
							gap: 40,
							alignItems: "flex-start",
						}}
					>
						<View style={{ flex: 1.1, gap: 24 }}>
							{dishPhoto}
							{meta}
							<Servings
								value={servings}
								max={maxServings}
								label={copy.recipe.servings(servings)}
								onChange={setServings}
							/>
						</View>
						<View style={{ flex: 1 }}>{ingredients}</View>
					</View>
				) : (
					<View style={{ gap: 28 }}>
						{dishPhoto}
						{meta}
						<Servings
							value={servings}
							max={maxServings}
							label={copy.recipe.servings(servings)}
							onChange={setServings}
						/>
						{ingredients}
					</View>
				)}
				<Footer />
			</ScrollView>
		</Screen>
	);
}

function Servings({
	value,
	max,
	label,
	onChange,
}: {
	value: number;
	max: number;
	label: string;
	onChange: (value: number) => void;
}) {
	const { colors } = useTheme();
	return (
		<View style={{ gap: 8, maxWidth: 420 }}>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
			>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="-"
					onPress={() => onChange(Math.max(1, value - 1))}
					style={{
						width: 44,
						height: 44,
						borderRadius: 999,
						borderWidth: 1,
						borderColor: colors.border,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Text
						style={{
							fontFamily: fonts.body,
							fontSize: 22,
							color: colors.foreground,
						}}
					>
						−
					</Text>
				</Pressable>
				<Body
					style={{
						fontFamily: fonts.label,
						color: colors.foreground,
					}}
				>
					{label}
				</Body>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="+"
					onPress={() => onChange(Math.min(max, value + 1))}
					style={{
						width: 44,
						height: 44,
						borderRadius: 999,
						borderWidth: 1,
						borderColor: colors.border,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Text
						style={{
							fontFamily: fonts.body,
							fontSize: 22,
							color: colors.foreground,
						}}
					>
						+
					</Text>
				</Pressable>
			</View>
			<Slider
				minimumValue={1}
				maximumValue={max}
				step={1}
				value={value}
				onValueChange={(next) => onChange(Math.round(next))}
				minimumTrackTintColor={colors.foreground}
				maximumTrackTintColor={colors.border}
				thumbTintColor={colors.accent}
			/>
		</View>
	);
}

export function importFailureMessage(
	error: unknown,
	home: ReturnType<typeof useI18n>["copy"]["home"],
) {
	if (error instanceof ApiError && error.code === "NETWORK") {
		return home.offline;
	}
	const message = error instanceof Error ? error.message : "";
	if (
		message === "fetch_failed" ||
		message === "not_a_recipe" ||
		message === "extract_failed" ||
		message === "not_configured"
	) {
		return home[message];
	}
	return home.extract_failed;
}
