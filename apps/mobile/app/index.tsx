import { useLocalSearchParams, useRouter } from "expo-router";
import { Link as LinkIcon } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { api, apiCode } from "@/api/client";
import type { StarterRecipe } from "@/api/types";
import { Footer, Header } from "@/components/Chrome";
import { importFailureMessage } from "@/components/RecipeScreen";
import { StarterCarousel } from "@/components/StarterCarousel";
import { Body, Button, Display, Field, Notice, Screen } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useLayout } from "@/lib/layout";
import { oneParam, recipeUrlFromImport } from "@/lib/params";
import { useTheme } from "@/theme/theme";

const resumed = new Set<string>();

export default function HomeScreen() {
	const { copy, locale } = useI18n();
	const { colors } = useTheme();
	const layout = useLayout();
	const router = useRouter();
	const params = useLocalSearchParams<{ import?: string }>();
	const importUrl = recipeUrlFromImport(oneParam(params.import));
	const [url, setUrl] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [invalid, setInvalid] = useState(false);
	const [pending, setPending] = useState(false);
	const [needsCredit, setNeedsCredit] = useState(false);
	const [starters, setStarters] = useState<StarterRecipe[] | null>(null);
	const started = useRef(false);

	useEffect(() => {
		let cancelled = false;
		void api
			.starters(locale)
			.then((recipes) => {
				if (!cancelled) {
					setStarters(recipes);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setStarters([]);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [locale]);

	useEffect(() => {
		if (!importUrl || resumed.has(importUrl) || started.current) {
			return;
		}
		started.current = true;
		resumed.add(importUrl);
		setPending(true);
		void api
			.importRecipe(importUrl, locale)
			.then((result) => {
				router.replace(`/recipes/${result.recipeId}`);
			})
			.catch((error: unknown) => {
				router.replace("/");
				if (apiCode(error) === "UNAUTHORIZED") {
					router.push(
						`/login?next=${encodeURIComponent(`/?import=${encodeURIComponent(importUrl)}`)}`,
					);
					return;
				}
				if (apiCode(error) === "INSUFFICIENT_CREDITS") {
					setNeedsCredit(true);
					return;
				}
				setInvalid(true);
				setMessage(importFailureMessage(error, copy.home));
			})
			.finally(() => {
				setPending(false);
				started.current = false;
			});
	}, [importUrl, locale, router, copy.home]);

	function submit() {
		if (pending) {
			return;
		}
		let parsed: URL;
		try {
			parsed = new URL(url.trim());
		} catch {
			setInvalid(true);
			setMessage(copy.home.invalidUrl);
			return;
		}
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			setInvalid(true);
			setMessage(copy.home.invalidUrl);
			return;
		}
		setInvalid(false);
		setMessage(null);
		setNeedsCredit(false);
		setPending(true);
		void api
			.importRecipe(parsed.href, locale)
			.then((result) => {
				router.push(`/recipes/${result.recipeId}`);
			})
			.catch((error: unknown) => {
				if (apiCode(error) === "UNAUTHORIZED") {
					router.push(
						`/login?next=${encodeURIComponent(`/?import=${encodeURIComponent(parsed.href)}`)}`,
					);
					return;
				}
				if (apiCode(error) === "INSUFFICIENT_CREDITS") {
					setNeedsCredit(true);
					return;
				}
				setInvalid(true);
				setMessage(importFailureMessage(error, copy.home));
			})
			.finally(() => setPending(false));
	}

	return (
		<Screen>
			<Header home />
			<ScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{
					flexGrow: 1,
					justifyContent: "center",
				}}
			>
				<View
					style={{
						width: "100%",
						maxWidth: layout.contentWidth,
						alignSelf: "center",
						paddingHorizontal: layout.pagePadding,
						paddingVertical: 32,
						gap: 32,
					}}
				>
					<View style={{ gap: 16 }}>
						<Display size={layout.displaySize} center>
							{copy.home.title}
						</Display>
						<Body center muted>
							{copy.home.subtitle}
						</Body>
					</View>
					<View style={{ gap: 12 }}>
						<View
							style={{
								flexDirection: layout.isTablet
									? "row"
									: "column",
								gap: 12,
								alignItems: "stretch",
							}}
						>
							<Field
								label={copy.home.placeholder}
								value={url}
								onChangeText={(next) => {
									setUrl(next);
									if (message) {
										setMessage(null);
										setInvalid(false);
									}
								}}
								invalid={invalid}
								placeholder={copy.home.placeholder}
								keyboardType="url"
								autoComplete="off"
								autoCapitalize="none"
								editable={!pending}
								onSubmitEditing={submit}
								icon={
									<LinkIcon
										color={colors.foreground}
										size={20}
									/>
								}
							/>
							<Button
								label={copy.home.submit}
								loading={pending}
								onPress={submit}
							/>
						</View>
						{message ? (
							<Notice tone={invalid ? "danger" : "muted"}>
								{message}
							</Notice>
						) : null}
						{needsCredit ? (
							<View style={{ gap: 12 }}>
								<Display size={28}>
									{copy.billing.emptyTitle}
								</Display>
								<Body muted>{copy.billing.emptyBody}</Body>
								<Body muted>{copy.billing.storeNote}</Body>
								<Button
									label={copy.billing.seeCredits}
									variant="outline"
									onPress={() => router.push("/credits")}
								/>
							</View>
						) : null}
					</View>
				</View>
				<StarterCarousel recipes={starters} />
				<Footer />
			</ScrollView>
		</Screen>
	);
}
