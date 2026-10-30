import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse } from "react-native-svg";
import type { StarterRecipe } from "@/api/types";
import { useI18n } from "@/i18n";
import { useLayout } from "@/lib/layout";
import { useTheme } from "@/theme/theme";
import { fonts, radii } from "@/theme/tokens";
import { Body, Display } from "./ui";

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

export function StarterGrid({ recipes }: { recipes: StarterRecipe[] | null }) {
	const { copy } = useI18n();
	const { colors } = useTheme();
	const { width, pagePadding, isTablet } = useLayout();
	const columns = width >= 1100 ? 4 : width >= 700 ? 3 : 2;
	const gap = 12;
	const contentWidth =
		Math.min(width, isTablet ? 1120 : width) - pagePadding * 2;
	const cardWidth = (contentWidth - gap * (columns - 1)) / columns;

	return (
		<View
			accessibilityLabel={copy.home.startersLabel}
			style={{
				width: "100%",
				maxWidth: isTablet ? 1120 : undefined,
				alignSelf: "center",
				paddingHorizontal: pagePadding,
				gap: 20,
			}}
		>
			<Display size={isTablet ? 36 : 30} center>
				{copy.home.startersTitle}
			</Display>
			{recipes && recipes.length === 0 ? (
				<Body center muted>
					{copy.home.startersEmpty}
				</Body>
			) : (
				<View style={[styles.grid, { gap }]}>
					{recipes
						? recipes.map((recipe) => (
								<StarterCard
									key={recipe.recipeId}
									recipe={recipe}
									width={cardWidth}
								/>
							))
						: [0, 1, 2, 3].map((slot) => (
								<View
									key={slot}
									style={{ width: cardWidth, gap: 10 }}
								>
									<View
										style={[
											styles.cover,
											{ backgroundColor: colors.muted },
										]}
									/>
									<View
										style={{
											height: 16,
											width: "72%",
											borderRadius: 8,
											backgroundColor: colors.muted,
										}}
									/>
								</View>
							))}
				</View>
			)}
		</View>
	);
}

function StarterCard({
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
			style={({ pressed }) => [{ width, opacity: pressed ? 0.82 : 1 }]}
		>
			<View style={[styles.cover, { backgroundColor: colors.muted }]}>
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
			</View>
			<Body
				style={{
					marginTop: 10,
					fontFamily: fonts.display,
					fontSize: 18,
					lineHeight: 22,
					color: colors.foreground,
				}}
			>
				{recipe.title}
			</Body>
			{meta ? (
				<Body muted size={14} style={{ marginTop: 2 }}>
					{meta}
				</Body>
			) : null}
		</Pressable>
	);
}

function PlateFallback({ initial }: { initial: string }) {
	const { colors } = useTheme();
	return (
		<View style={[styles.fallback, { backgroundColor: colors.muted }]}>
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
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
	},
	cover: {
		width: "100%",
		aspectRatio: 4 / 3,
		borderRadius: radii.icon,
		overflow: "hidden",
	},
	fallback: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
});
