import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Timer } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
	Animated,
	Image,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	Vibration,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/i18n";
import {
	findDuration,
	findEmphasis,
	highlightStep,
	ingredientIconKey,
	placeDuration,
	placeEmphasis,
	type StepIngredient,
	type StepPiece,
} from "@/lib/highlight-step";
import { useLayout } from "@/lib/layout";
import { fonts, palettes } from "@/theme/tokens";

const KEEP_AWAKE = "cooking";

export interface CookingStep {
	id: string;
	text: string;
	ingredients: StepIngredient[];
	timerSeconds: number | null;
}

function formatClock(totalSeconds: number) {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = (totalSeconds % 60).toString().padStart(2, "0");
	if (hours > 0) {
		return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds}`;
	}
	return `${minutes}:${seconds}`;
}

function secondsLeft(endsAt: number, now: number) {
	return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function CookingMode({
	steps,
	iconsByKey,
	onExit,
}: {
	steps: CookingStep[];
	iconsByKey: Record<string, string>;
	onExit: () => void;
}) {
	const { copy, locale } = useI18n();
	const { split, pagePadding } = useLayout();
	const insets = useSafeAreaInsets();
	const colors = palettes.dark;
	const [index, setIndex] = useState(0);
	const [now, setNow] = useState(() => Date.now());
	const [running, setRunning] = useState<{
		stepIndex: number;
		endsAt: number;
	} | null>(null);
	const wiggle = useRef(new Animated.Value(0)).current;
	const finishedAt = useRef<number | null>(null);
	const step = steps[index];
	const isLast = index === steps.length - 1;

	useEffect(() => {
		void activateKeepAwakeAsync(KEEP_AWAKE);
		return () => {
			void deactivateKeepAwake(KEEP_AWAKE);
		};
	}, []);

	useEffect(() => {
		if (!running || running.endsAt <= Date.now()) {
			return;
		}
		const timer = setInterval(() => {
			const next = Date.now();
			setNow(next);
			if (next >= running.endsAt) {
				clearInterval(timer);
			}
		}, 1000);
		return () => clearInterval(timer);
	}, [running]);

	const remaining = running ? secondsLeft(running.endsAt, now) : null;

	useEffect(() => {
		if (
			!running ||
			remaining !== 0 ||
			finishedAt.current === running.endsAt
		) {
			return;
		}
		finishedAt.current = running.endsAt;
		Vibration.vibrate(400);
	}, [remaining, running]);

	if (!step) {
		return null;
	}

	const duration =
		step.timerSeconds == null
			? null
			: findDuration(step.text, step.timerSeconds);
	const pieces = placeDuration(
		placeEmphasis(
			highlightStep(step.text, step.ingredients),
			findEmphasis(step.text),
		),
		duration,
	);
	const rotate = wiggle.interpolate({
		inputRange: [-1, 1],
		outputRange: ["-8deg", "8deg"],
	});

	function wiggleChip() {
		wiggle.setValue(0);
		Animated.sequence([
			Animated.timing(wiggle, {
				toValue: 1,
				duration: 90,
				useNativeDriver: true,
			}),
			Animated.timing(wiggle, {
				toValue: -1,
				duration: 90,
				useNativeDriver: true,
			}),
			Animated.timing(wiggle, {
				toValue: 0,
				duration: 90,
				useNativeDriver: true,
			}),
		]).start();
	}

	function startTimer() {
		if (step?.timerSeconds == null) {
			return;
		}
		if (running?.stepIndex === index) {
			wiggleChip();
			return;
		}
		const started = Date.now();
		setNow(started);
		setRunning({
			stepIndex: index,
			endsAt: started + step.timerSeconds * 1000,
		});
	}

	function fallbackDuration(seconds: number) {
		const unit =
			seconds < 60 ? "second" : seconds % 3600 === 0 ? "hour" : "minute";
		const value =
			unit === "second"
				? seconds
				: unit === "hour"
					? Math.max(1, Math.round(seconds / 3600))
					: Math.max(1, Math.round(seconds / 60));
		return new Intl.NumberFormat(locale, {
			style: "unit",
			unit,
			unitDisplay: "long",
		}).format(value);
	}

	const timerChip =
		running && remaining != null ? (
			<Animated.View style={{ transform: [{ rotate }] }}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={copy.recipe.timerReturn}
					onPress={() => setIndex(running.stepIndex)}
					style={[
						styles.chip,
						{ backgroundColor: `${colors.timer}1A` },
					]}
				>
					<Timer color={colors.timer} size={20} strokeWidth={2.25} />
					<Text style={[styles.chipText, { color: colors.timer }]}>
						{remaining === 0
							? copy.recipe.timerDone
							: formatClock(remaining)}
					</Text>
				</Pressable>
			</Animated.View>
		) : (
			<View style={styles.chipSpacer} />
		);

	return (
		<View style={[styles.root, { backgroundColor: colors.background }]}>
			<View
				style={[
					styles.header,
					{
						paddingTop: Math.max(insets.top, 16),
						paddingHorizontal: pagePadding,
					},
				]}
			>
				<Pressable
					accessibilityRole="button"
					onPress={onExit}
					hitSlop={8}
				>
					<Text
						style={[
							styles.headerText,
							{ color: colors.foreground },
						]}
					>
						{copy.recipe.overview}
					</Text>
				</Pressable>
				{timerChip}
				<Text style={[styles.headerText, { color: colors.foreground }]}>
					{copy.recipe.progress(index + 1, steps.length)}
				</Text>
			</View>
			<View style={[styles.body, split ? styles.bodySplit : null]}>
				<ScrollView
					style={styles.stepScroll}
					contentContainerStyle={[
						styles.stepContent,
						{ paddingHorizontal: pagePadding },
					]}
				>
					<Text
						style={[
							styles.step,
							{
								color: colors.foreground,
								fontSize: split ? 40 : 30,
								lineHeight: split ? 52 : 40,
							},
						]}
					>
						{pieces.map((piece, pieceIndex) => (
							<StepFragment
								key={`${piece.sourceStart}-${pieceIndex}`}
								piece={piece}
								iconsByKey={iconsByKey}
								onStartTimer={startTimer}
							/>
						))}
						{step.timerSeconds != null &&
						!pieces.some((piece) => piece.timer) ? (
							<Text
								onPress={startTimer}
								style={[
									styles.timerText,
									{ color: colors.timer },
								]}
							>
								{` ${fallbackDuration(step.timerSeconds)}`}
							</Text>
						) : null}
					</Text>
				</ScrollView>
				{split ? (
					<ScrollView
						style={styles.sideScroll}
						contentContainerStyle={[
							styles.side,
							{
								borderColor: colors.border,
								backgroundColor: colors.card,
							},
						]}
					>
						<Text
							style={[
								styles.sideTitle,
								{ color: colors.foreground },
							]}
						>
							{copy.recipe.stepIngredients}
						</Text>
						{step.ingredients.length === 0 ? (
							<Text
								style={[
									styles.sideEmpty,
									{ color: colors.mutedForeground },
								]}
							>
								—
							</Text>
						) : (
							step.ingredients.map((ingredient) => {
								const key = ingredient.canonicalKey
									? ingredientIconKey(ingredient.canonicalKey)
									: null;
								const iconUrl = key ? iconsByKey[key] : null;
								const amount = [
									ingredient.scaledQuantity,
									ingredient.scaledUnit ?? ingredient.unit,
								]
									.filter(Boolean)
									.join(" ");
								return (
									<View
										key={ingredient.id}
										style={styles.sideRow}
									>
										{iconUrl ? (
											<Image
												source={{ uri: iconUrl }}
												style={styles.sideIcon}
											/>
										) : (
											<View
												style={[
													styles.sideIcon,
													{
														backgroundColor:
															colors.accent,
													},
												]}
											/>
										)}
										<View style={styles.sideCopy}>
											<Text
												style={[
													styles.sideName,
													{
														color: colors.foreground,
													},
												]}
											>
												{ingredient.name}
											</Text>
											{amount ? (
												<Text
													style={[
														styles.sideAmount,
														{
															color: colors.mutedForeground,
														},
													]}
												>
													{amount}
												</Text>
											) : null}
										</View>
									</View>
								);
							})
						)}
					</ScrollView>
				) : null}
			</View>
			<View
				style={[
					styles.footer,
					{
						paddingHorizontal: pagePadding,
						paddingBottom: Math.max(insets.bottom, 20),
					},
				]}
			>
				{index > 0 ? (
					<Pressable
						accessibilityRole="button"
						onPress={() => setIndex((current) => current - 1)}
						style={[
							styles.navButton,
							{ borderColor: colors.border },
						]}
					>
						<Text
							style={[
								styles.navLabel,
								{ color: colors.foreground },
							]}
						>
							{copy.recipe.previous}
						</Text>
					</Pressable>
				) : null}
				<Pressable
					accessibilityRole="button"
					onPress={() => {
						if (isLast) {
							onExit();
							return;
						}
						setIndex((current) => current + 1);
					}}
					style={[
						styles.navButton,
						styles.navFill,
						{ backgroundColor: colors.accent },
					]}
				>
					<Text
						style={[
							styles.navLabel,
							{ color: colors.accentForeground },
						]}
					>
						{isLast ? copy.recipe.done : copy.recipe.next}
					</Text>
				</Pressable>
			</View>
		</View>
	);
}

function StepFragment({
	piece,
	iconsByKey,
	onStartTimer,
}: {
	piece: StepPiece;
	iconsByKey: Record<string, string>;
	onStartTimer: () => void;
}) {
	const colors = palettes.dark;
	if (piece.timer) {
		return (
			<Text
				onPress={onStartTimer}
				style={[styles.timerText, { color: colors.timer }]}
			>
				{piece.text}
			</Text>
		);
	}
	if (piece.emphasis) {
		return <Text style={styles.emphasis}>{piece.text}</Text>;
	}
	if (!piece.ingredient) {
		return <Text>{piece.text}</Text>;
	}
	const iconKey = piece.ingredient.canonicalKey
		? ingredientIconKey(piece.ingredient.canonicalKey)
		: null;
	const iconUrl = iconKey ? iconsByKey[iconKey] : null;
	return (
		<Text style={styles.emphasis}>
			{iconUrl ? (
				<Image source={{ uri: iconUrl }} style={styles.inlineIcon} />
			) : null}
			{piece.text}
		</Text>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	header: {
		minHeight: 72,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},
	headerText: {
		fontFamily: fonts.body,
		fontSize: 18,
	},
	chip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		borderRadius: 999,
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	chipText: {
		fontFamily: fonts.label,
		fontSize: 18,
	},
	chipSpacer: {
		width: 24,
	},
	body: {
		flex: 1,
	},
	bodySplit: {
		flexDirection: "row",
		alignItems: "stretch",
	},
	stepScroll: {
		flex: 1,
	},
	stepContent: {
		flexGrow: 1,
		justifyContent: "center",
		paddingVertical: 24,
	},
	step: {
		fontFamily: fonts.body,
		fontSize: 32,
		lineHeight: 42,
	},
	timerText: {
		fontFamily: fonts.label,
		backgroundColor: "rgba(240, 148, 58, 0.12)",
	},
	emphasis: {
		fontFamily: fonts.label,
	},
	inlineIcon: {
		width: 28,
		height: 28,
		borderRadius: 6,
	},
	sideScroll: {
		width: 320,
		marginRight: 24,
		marginBottom: 12,
	},
	side: {
		borderRadius: 28,
		borderWidth: 1,
		padding: 20,
		gap: 16,
	},
	sideTitle: {
		fontFamily: fonts.display,
		fontSize: 28,
	},
	sideEmpty: {
		fontFamily: fonts.body,
		fontSize: 18,
	},
	sideRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	sideIcon: {
		width: 48,
		height: 48,
		borderRadius: 16,
	},
	sideCopy: {
		flex: 1,
		gap: 2,
	},
	sideName: {
		fontFamily: fonts.body,
		fontSize: 18,
	},
	sideAmount: {
		fontFamily: fonts.body,
		fontSize: 16,
	},
	footer: {
		flexDirection: "row",
		gap: 12,
		paddingTop: 8,
	},
	navButton: {
		minHeight: 64,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: "transparent",
		paddingHorizontal: 24,
		alignItems: "center",
		justifyContent: "center",
	},
	navFill: {
		flex: 1,
	},
	navLabel: {
		fontFamily: fonts.label,
		fontSize: 18,
	},
});
