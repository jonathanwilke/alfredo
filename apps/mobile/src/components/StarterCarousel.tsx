import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { type ReactNode, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Pressable,
	ScrollView,
	type ScrollViewInstance,
	StyleSheet,
	View,
} from "react-native";
import Svg, { Circle, Ellipse } from "react-native-svg";
import type { StarterRecipe } from "@/api/types";
import { useI18n } from "@/i18n";
import { useLayout } from "@/lib/layout";
import { useTheme } from "@/theme/theme";
import { fonts, radii } from "@/theme/tokens";
import { Body, Display } from "./ui";

const GAP = 16;

function coverUrl(recipe: StarterRecipe) {
	const photo = recipe.image?.trim();
	if (photo) {
		return photo;
	}
	return recipe.heroIconUrl?.trim() || null;
}

function metaLine(
	recipe: StarterRecipe,
	minutes: (count: number) => string,
	servings: (count: number) => string,
) {
	const total = recipe.totalTimeSeconds;
	const time =
		total != null && total > 0
			? minutes(Math.max(1, Math.round(total / 60)))
			: null;
	const portion = recipe.servings != null ? servings(recipe.servings) : null;
	return [time, portion].filter(Boolean).join(" · ");
}

export function StarterCarousel({
	recipes,
}: {
	recipes: StarterRecipe[] | null;
}) {
	const { copy } = useI18n();
	const { colors } = useTheme();
	const { width, pagePadding } = useLayout();
	const [viewport, setViewport] = useState(0);
	const [offset, setOffset] = useState(0);
	const scroller = useRef<ScrollViewInstance>(null);
	const visible = width >= 1100 ? 4 : width >= 700 ? 3 : 1.7;
	const showArrows = width >= 1024;
	const cardWidth =
		viewport > 0 ? (viewport - GAP * (visible - 1)) / visible : 0;
	const step = cardWidth + GAP;
	const maxOffset = Math.max(
		0,
		(recipes?.length ?? 0) * step - GAP - viewport,
	);
	const canPrev = offset > 4;
	const canNext = offset < maxOffset - 4;

	async function scrollByCard(direction: number) {
		const reduce = await AccessibilityInfo.isReduceMotionEnabled();
		scroller.current?.scrollTo({
			x: Math.min(maxOffset, Math.max(0, offset + direction * step)),
			animated: !reduce,
		});
	}

	return (
		<View
			accessibilityLabel={copy.home.startersLabel}
			style={{ width: "100%", paddingHorizontal: pagePadding, gap: 20 }}
		>
			<Display size={width >= 700 ? 36 : 30} center>
				{copy.home.startersTitle}
			</Display>
			{recipes && recipes.length === 0 ? (
				<Body center muted>
					{copy.home.startersEmpty}
				</Body>
			) : (
				<View style={styles.row}>
					<ScrollView
						ref={scroller}
						horizontal
						showsHorizontalScrollIndicator={false}
						decelerationRate="fast"
						snapToInterval={step > 0 ? step : undefined}
						snapToAlignment="start"
						disableIntervalMomentum
						onLayout={(event) =>
							setViewport(event.nativeEvent.layout.width)
						}
						onScroll={(event) =>
							setOffset(event.nativeEvent.contentOffset.x)
						}
						scrollEventThrottle={16}
						contentContainerStyle={{ gap: GAP }}
					>
						{recipes
							? recipes.map((recipe) => (
									<StarterTile
										key={recipe.recipeId}
										recipe={recipe}
										width={cardWidth}
									/>
								))
							: [0, 1, 2].map((slot) => (
									<View
										key={slot}
										style={[
											styles.tile,
											{
												width: cardWidth || 220,
												backgroundColor: colors.muted,
											},
										]}
									/>
								))}
					</ScrollView>
					{showArrows ? (
						<>
							<ArrowButton
								label={copy.home.startersPrevious}
								disabled={!canPrev}
								onPress={() => void scrollByCard(-1)}
								side="left"
							>
								<ChevronLeft
									color={colors.foreground}
									size={22}
								/>
							</ArrowButton>
							<ArrowButton
								label={copy.home.startersNext}
								disabled={!canNext}
								onPress={() => void scrollByCard(1)}
								side="right"
							>
								<ChevronRight
									color={colors.foreground}
									size={22}
								/>
							</ArrowButton>
						</>
					) : null}
				</View>
			)}
		</View>
	);
}

function StarterTile({
	recipe,
	width,
}: {
	recipe: StarterRecipe;
	width: number;
}) {
	const { copy } = useI18n();
	const { colors } = useTheme();
	const router = useRouter();
	const imageUrl = coverUrl(recipe);
	const meta = metaLine(recipe, copy.recipe.minutes, copy.recipe.servings);
	const initial = recipe.title.trim().charAt(0).toUpperCase() || "·";

	return (
		<Pressable
			accessibilityRole="link"
			accessibilityLabel={
				meta ? `${recipe.title}, ${meta}` : recipe.title
			}
			onPress={() => router.push(`/recipes/${recipe.recipeId}`)}
			style={({ pressed }) => [
				styles.tile,
				{
					width: width || 220,
					backgroundColor: colors.muted,
					opacity: pressed ? 0.9 : 1,
				},
			]}
		>
			{imageUrl ? (
				<Image
					source={{ uri: imageUrl }}
					style={StyleSheet.absoluteFill}
					contentFit="cover"
					transition={200}
					accessibilityIgnoresInvertColors
				/>
			) : (
				<PlateFallback initial={initial} />
			)}
			<LinearGradient
				colors={["transparent", "rgba(26,29,20,0.9)"]}
				style={styles.scrim}
			>
				<Body
					style={{
						fontFamily: fonts.display,
						fontSize: 20,
						lineHeight: 24,
						color: "#FFFFFF",
					}}
				>
					{recipe.title}
				</Body>
				{meta ? (
					<Body size={14} style={{ color: "rgba(255,255,255,0.85)" }}>
						{meta}
					</Body>
				) : null}
			</LinearGradient>
		</Pressable>
	);
}

function ArrowButton({
	label,
	disabled,
	onPress,
	side,
	children,
}: {
	label: string;
	disabled: boolean;
	onPress: () => void;
	side: "left" | "right";
	children: ReactNode;
}) {
	const { colors } = useTheme();
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={{
				position: "absolute",
				top: "38%",
				[side]: 0,
				width: 44,
				height: 44,
				borderRadius: 22,
				borderWidth: 1,
				borderColor: colors.border,
				backgroundColor: `${colors.background}E6`,
				alignItems: "center",
				justifyContent: "center",
				opacity: disabled ? 0.4 : 1,
			}}
		>
			{children}
		</Pressable>
	);
}

function PlateFallback({ initial }: { initial: string }) {
	const { colors } = useTheme();
	return (
		<View style={styles.fallback}>
			<Svg width="100%" height="70%" viewBox="0 0 160 120">
				<Ellipse cx="80" cy="78" rx="52" ry="18" fill="#E7DCC8" />
				<Circle
					cx="80"
					cy="58"
					r="36"
					fill={colors.background}
					stroke={colors.leaf}
					strokeWidth="3"
				/>
				<Circle
					cx="80"
					cy="58"
					r="20"
					fill="none"
					stroke="#C3D56D"
					strokeWidth="2"
				/>
			</Svg>
			<View
				style={[
					StyleSheet.absoluteFill,
					{ alignItems: "center", justifyContent: "center" },
				]}
			>
				<Body
					style={{
						fontFamily: fonts.display,
						fontSize: 32,
						lineHeight: 36,
						color: colors.foreground,
					}}
				>
					{initial}
				</Body>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		position: "relative",
	},
	tile: {
		aspectRatio: 4 / 3,
		borderRadius: radii.icon,
		overflow: "hidden",
	},
	scrim: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		paddingHorizontal: 14,
		paddingTop: 48,
		paddingBottom: 14,
		gap: 2,
	},
	fallback: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#F6F9E8",
	},
});
