import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { api, apiCode } from "@/api/client";
import { Footer, Header } from "@/components/Chrome";
import { Body, Button, Display, Notice, Screen } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useLayout } from "@/lib/layout";
import { useTheme } from "@/theme/theme";

export default function SavedScreen() {
	const { copy, locale } = useI18n();
	const { colors } = useTheme();
	const layout = useLayout();
	const router = useRouter();
	const [recipes, setRecipes] = useState<
		{ recipeId: string; title: string }[] | null
	>(null);
	const [failed, setFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setFailed(false);
		void api
			.savedRecipes(locale)
			.then((result) => {
				if (!cancelled) {
					setRecipes(result);
				}
			})
			.catch((error: unknown) => {
				if (cancelled) {
					return;
				}
				if (apiCode(error) === "UNAUTHORIZED") {
					router.replace("/login?next=%2Fsaved");
					return;
				}
				setFailed(true);
				setRecipes([]);
			});
		return () => {
			cancelled = true;
		};
	}, [locale, router, attempt]);

	const columns = layout.isTablet ? 2 : 1;

	return (
		<Screen>
			<Header />
			<ScrollView contentContainerStyle={{ flexGrow: 1 }}>
				<View
					style={{
						width: "100%",
						maxWidth: layout.contentWidth,
						alignSelf: "center",
						paddingHorizontal: layout.pagePadding,
						paddingVertical: 28,
						gap: 24,
					}}
				>
					<Display size={layout.displaySize}>
						{copy.home.savedRecipes}
					</Display>
					{recipes === null && !failed ? <ActivityIndicator /> : null}
					{failed ? (
						<View style={{ gap: 12 }}>
							<Notice tone="danger">
								{copy.home.savedFailed}
							</Notice>
							<Button
								label={copy.recipe.retry}
								variant="ghost"
								onPress={() => setAttempt((value) => value + 1)}
							/>
						</View>
					) : null}
					{recipes && recipes.length === 0 && !failed ? (
						<Body muted>{copy.home.savedEmpty}</Body>
					) : null}
					<View
						style={{
							flexDirection: "row",
							flexWrap: "wrap",
							gap: 12,
						}}
					>
						{recipes?.map((recipe) => (
							<Pressable
								key={recipe.recipeId}
								accessibilityRole="link"
								onPress={() =>
									router.push(`/recipes/${recipe.recipeId}`)
								}
								style={{
									flexBasis: columns === 2 ? "47%" : "100%",
									minHeight: 64,
									justifyContent: "center",
									borderBottomWidth: 1,
									borderBottomColor: colors.border,
								}}
							>
								<Body style={{ color: colors.foreground }}>
									{recipe.title}
								</Body>
							</Pressable>
						))}
					</View>
				</View>
				<Footer />
			</ScrollView>
		</Screen>
	);
}
