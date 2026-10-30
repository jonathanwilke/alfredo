import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { ChevronDown, ChevronUp, Timer, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Image,
	Pressable,
	ScrollView,
	type ScrollViewInstance,
	StyleSheet,
	Text,
	View,
} from "react-native";
import Animated, {
	Extrapolation,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/i18n";
import {
	decorateStep,
	ingredientIconKey,
	type StepIngredient,
	type StepPiece,
} from "@/lib/highlight-step";
import { useLayout } from "@/lib/layout";
import {
	addCookMinute,
	cancelCookTimer,
	pauseCookTimer,
	remainingSeconds,
	resumeCookTimer,
	startCookTimer,
	useCookTimers,
	useTimerAlert,
	useTimerClock,
} from "@/lib/timers";
import { fonts, palettes } from "@/theme/tokens";

const KEEP_AWAKE = "cooking";
const colors = palettes.dark;

export interface CookingStep {
	id: string;
	text: string;
	ingredients: StepIngredient[];
	timerSeconds: number | null;
}

type StepLayout = {
	y: number;
	height: number;
};

function formatClock(totalSeconds: number) {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = (totalSeconds % 60).toString().padStart(2, "0");
	if (hours > 0) {
		return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds}`;
	}
	return `${minutes}:${seconds}`;
}

function fallbackDuration(seconds: number, locale: string) {
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

function piecesFor(step: CookingStep, locale: string) {
	const pieces = decorateStep(step.text, step.ingredients);
	if (pieces.some((piece) => piece.timer) || step.timerSeconds == null) {
		return pieces;
	}
	const text = fallbackDuration(step.timerSeconds, locale);
	return [
		...pieces,
		{
			text,
			ingredient: null,
			timer: true,
			timerSeconds: step.timerSeconds,
			sourceStart: step.text.length,
			sourceEnd: step.text.length,
		} satisfies StepPiece,
	];
}

function closestStep(
	scrollY: number,
	viewport: number,
	layouts: (StepLayout | undefined)[],
) {
	const focus = scrollY + viewport * 0.32;
	let best = 0;
	let bestDistance = Number.POSITIVE_INFINITY;
	layouts.forEach((layout, index) => {
		if (!layout) {
			return;
		}
		const middle = layout.y + layout.height / 2;
		const distance = Math.abs(middle - focus);
		if (distance < bestDistance) {
			best = index;
			bestDistance = distance;
		}
	});
	return best;
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
	const { split, pagePadding, isTablet } = useLayout();
	const insets = useSafeAreaInsets();
	const { timers, now } = useTimerClock();
	const alert = useTimerAlert();
	const [index, setIndex] = useState(0);
	const [viewport, setViewport] = useState(0);
	const [banner, setBanner] = useState<string | null>(null);
	const [reduceMotion, setReduceMotion] = useState(false);
	const scrollRef = useRef<ScrollViewInstance>(null);
	const layouts = useRef<(StepLayout | undefined)[]>([]);
	const focusing = useRef(false);
	const active = useSharedValue(0);
	const fontSize = isTablet ? 40 : 30;
	const lineHeight = isTablet ? 52 : 40;
	const step = steps[index];

	useEffect(() => {
		void activateKeepAwakeAsync(KEEP_AWAKE);
		return () => {
			void deactivateKeepAwake(KEEP_AWAKE);
		};
	}, []);

	useEffect(() => {
		let mounted = true;
		void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
			if (mounted) {
				setReduceMotion(enabled);
			}
		});
		const subscription = AccessibilityInfo.addEventListener(
			"reduceMotionChanged",
			setReduceMotion,
		);
		return () => {
			mounted = false;
			subscription.remove();
		};
	}, []);

	useEffect(() => {
		active.value = withTiming(index, {
			duration: reduceMotion ? 0 : 280,
		});
	}, [active, index, reduceMotion]);

	useEffect(() => {
		if (!alert) {
			return;
		}
		setBanner(alert.label);
		const timeout = setTimeout(() => {
			setBanner((current) => (current === alert.label ? null : current));
		}, 4000);
		return () => clearTimeout(timeout);
	}, [alert]);

	function focusStep(next: number) {
		const layout = layouts.current[next];
		if (!layout || viewport === 0) {
			setIndex(next);
			return;
		}
		focusing.current = true;
		setIndex(next);
		scrollRef.current?.scrollTo({
			y: Math.max(0, layout.y - viewport * 0.22),
			animated: !reduceMotion,
		});
		setTimeout(
			() => {
				focusing.current = false;
			},
			reduceMotion ? 0 : 420,
		);
	}

	if (!step) {
		return null;
	}

	return (
		<View style={[styles.root, { backgroundColor: colors.background }]}>
			<View
				style={[
					styles.header,
					{
						paddingTop: Math.max(insets.top, 12),
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
				<View style={styles.headerNav}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={copy.recipe.previous}
						disabled={index === 0}
						onPress={() => focusStep(Math.max(0, index - 1))}
						hitSlop={8}
						style={{ opacity: index === 0 ? 0.35 : 1 }}
					>
						<ChevronUp color={colors.foreground} size={26} />
					</Pressable>
					<Text
						style={[
							styles.headerText,
							{ color: colors.foreground },
						]}
					>
						{copy.recipe.progress(index + 1, steps.length)}
					</Text>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={copy.recipe.next}
						disabled={index === steps.length - 1}
						onPress={() =>
							focusStep(Math.min(steps.length - 1, index + 1))
						}
						hitSlop={8}
						style={{
							opacity: index === steps.length - 1 ? 0.35 : 1,
						}}
					>
						<ChevronDown color={colors.foreground} size={26} />
					</Pressable>
				</View>
			</View>
			{banner ? (
				<View
					accessibilityRole="alert"
					style={[styles.banner, { backgroundColor: colors.timer }]}
				>
					<Text
						style={[
							styles.bannerText,
							{ color: colors.background },
						]}
					>
						{copy.recipe.timerDone}
					</Text>
				</View>
			) : null}
			<View style={styles.stage}>
				<View style={[styles.body, split ? styles.bodySplit : null]}>
					{split ? (
						<IngredientColumn
							ingredients={step.ingredients}
							iconsByKey={iconsByKey}
							title={copy.recipe.stepIngredients}
						/>
					) : null}
					<ScrollView
						ref={scrollRef}
						style={styles.stepScroll}
						onLayout={(event) =>
							setViewport(event.nativeEvent.layout.height)
						}
						scrollEventThrottle={16}
						onScroll={(event) => {
							if (focusing.current || viewport === 0) {
								return;
							}
							const next = closestStep(
								event.nativeEvent.contentOffset.y,
								viewport,
								layouts.current,
							);
							setIndex((current) =>
								current === next ? current : next,
							);
						}}
						contentContainerStyle={{
							paddingTop: Math.max(24, viewport * 0.12),
							paddingBottom: viewport * 0.62,
							paddingHorizontal: pagePadding,
						}}
					>
						{steps.map((item, stepIndex) => (
							<StepBlock
								key={item.id}
								step={item}
								index={stepIndex}
								active={active}
								fontSize={fontSize}
								lineHeight={lineHeight}
								locale={locale}
								label={copy.recipe.stepLabel(stepIndex + 1)}
								alertBody={copy.recipe.timerDone}
								iconsByKey={iconsByKey}
								onFocus={focusStep}
								onLayout={(layout) => {
									layouts.current[stepIndex] = layout;
								}}
							/>
						))}
					</ScrollView>
				</View>
				<TimerTray timers={timers} now={now} inset={pagePadding} />
			</View>
		</View>
	);
}

function StepBlock({
	step,
	index,
	active,
	fontSize,
	lineHeight,
	locale,
	label,
	alertBody,
	iconsByKey,
	onFocus,
	onLayout,
}: {
	step: CookingStep;
	index: number;
	active: { value: number };
	fontSize: number;
	lineHeight: number;
	locale: string;
	label: string;
	alertBody: string;
	iconsByKey: Record<string, string>;
	onFocus: (index: number) => void;
	onLayout: (layout: StepLayout) => void;
}) {
	const animated = useAnimatedStyle(() => {
		const distance = Math.abs(active.value - index);
		return {
			opacity: interpolate(
				distance,
				[0, 1],
				[1, 0.32],
				Extrapolation.CLAMP,
			),
		};
	});
	const pieces = piecesFor(step, locale);

	return (
		<Animated.View
			style={[styles.stepBlock, animated]}
			onLayout={(event) => {
				const { y, height } = event.nativeEvent.layout;
				onLayout({ y, height });
			}}
		>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={label}
				onPress={() => onFocus(index)}
			>
				<Text style={[styles.stepLabel, { color: colors.foreground }]}>
					{label}
				</Text>
			</Pressable>
			<StepCopy
				pieces={pieces}
				fontSize={fontSize}
				lineHeight={lineHeight}
				stepId={step.id}
				stepIndex={index}
				alertBody={alertBody}
				iconsByKey={iconsByKey}
				onFocus={() => onFocus(index)}
			/>
		</Animated.View>
	);
}

function StepCopy({
	pieces,
	fontSize,
	lineHeight,
	stepId,
	stepIndex,
	alertBody,
	iconsByKey,
	onFocus,
}: {
	pieces: StepPiece[];
	fontSize: number;
	lineHeight: number;
	stepId: string;
	stepIndex: number;
	alertBody: string;
	iconsByKey: Record<string, string>;
	onFocus: () => void;
}) {
	return (
		<View style={styles.copy}>
			{pieces.map((piece, pieceIndex) => {
				if (piece.timer && piece.timerSeconds) {
					return (
						<TimerChip
							key={`timer-${piece.sourceStart}`}
							id={`${stepId}:${piece.sourceStart}`}
							text={piece.text}
							seconds={piece.timerSeconds}
							stepIndex={stepIndex}
							fontSize={fontSize}
							alertBody={alertBody}
						/>
					);
				}
				const iconKey = piece.ingredient?.canonicalKey
					? ingredientIconKey(piece.ingredient.canonicalKey)
					: null;
				const iconUrl = iconKey ? iconsByKey[iconKey] : null;
				const tokens = piece.text.match(/\s+|\S+/g) ?? [];
				return tokens.map((token, tokenIndex) => (
					<Text
						key={`${pieceIndex}-${tokenIndex}`}
						onPress={onFocus}
						suppressHighlighting
						style={{
							fontFamily:
								piece.ingredient || piece.emphasis
									? fonts.label
									: fonts.body,
							fontSize,
							lineHeight,
							color: colors.foreground,
						}}
					>
						{iconUrl && tokenIndex === 0 ? (
							<Image
								source={{ uri: iconUrl }}
								style={styles.inlineIcon}
							/>
						) : null}
						{token}
					</Text>
				));
			})}
		</View>
	);
}

function TimerChip({
	id,
	text,
	seconds,
	stepIndex,
	fontSize,
	alertBody,
}: {
	id: string;
	text: string;
	seconds: number;
	stepIndex: number;
	fontSize: number;
	alertBody: string;
}) {
	const timers = useCookTimers();
	const running = timers.some(
		(timer) => timer.id === id && timer.status !== "done",
	);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={text}
			onPress={() => {
				void startCookTimer({
					id,
					label: text,
					stepIndex,
					seconds,
					alertBody: `${alertBody} · ${text}`,
				});
			}}
			style={[
				styles.chip,
				{
					backgroundColor: running
						? "rgba(240, 148, 58, 0.28)"
						: "rgba(240, 148, 58, 0.14)",
				},
			]}
		>
			<Timer
				color={colors.timer}
				size={Math.round(fontSize * 0.62)}
				strokeWidth={2.25}
			/>
			<Text
				style={{
					fontFamily: fonts.label,
					fontSize: fontSize * 0.72,
					lineHeight: fontSize * 0.9,
					color: colors.timer,
				}}
			>
				{text}
			</Text>
		</Pressable>
	);
}

function IngredientColumn({
	ingredients,
	iconsByKey,
	title,
}: {
	ingredients: StepIngredient[];
	iconsByKey: Record<string, string>;
	title: string;
}) {
	return (
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
			<Text style={[styles.sideTitle, { color: colors.foreground }]}>
				{title}
			</Text>
			{ingredients.length === 0 ? (
				<Text
					style={[
						styles.sideEmpty,
						{ color: colors.mutedForeground },
					]}
				>
					—
				</Text>
			) : (
				ingredients.map((ingredient) => {
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
						<View key={ingredient.id} style={styles.sideRow}>
							{iconUrl ? (
								<Image
									source={{ uri: iconUrl }}
									style={styles.sideIcon}
								/>
							) : (
								<View
									style={[
										styles.sideIcon,
										{ backgroundColor: colors.accent },
									]}
								/>
							)}
							<View style={styles.sideCopy}>
								<Text
									style={[
										styles.sideName,
										{ color: colors.foreground },
									]}
								>
									{ingredient.name}
								</Text>
								{amount ? (
									<Text
										style={[
											styles.sideAmount,
											{ color: colors.mutedForeground },
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
	);
}

function TimerTray({
	timers,
	now,
	inset,
}: {
	timers: ReturnType<typeof useTimerClock>["timers"];
	now: number;
	inset: number;
}) {
	const { copy } = useI18n();
	if (timers.length === 0) {
		return null;
	}
	return (
		<View
			pointerEvents="box-none"
			style={[styles.floatWrap, { left: inset, right: inset }]}
		>
			<ScrollView
				style={styles.trayScroll}
				contentContainerStyle={styles.trayList}
			>
				{timers.map((timer) => {
					const remaining = remainingSeconds(timer, now);
					const clock =
						timer.status === "done"
							? copy.recipe.timerDone
							: formatClock(remaining);
					const toggleLabel =
						timer.status === "paused"
							? copy.recipe.timerResume
							: copy.recipe.timerPause;
					return (
						<View
							key={timer.id}
							style={[
								styles.trayRow,
								{ backgroundColor: `${colors.timer}1A` },
							]}
						>
							<Timer
								color={colors.timer}
								size={20}
								strokeWidth={2.25}
							/>
							<View style={styles.trayCopy}>
								<Text
									numberOfLines={1}
									style={[
										styles.trayTime,
										{ color: colors.timer },
									]}
								>
									{clock}
									<Text
										style={[
											styles.trayLabel,
											{ color: colors.foreground },
										]}
									>
										{`  ${timer.label}`}
									</Text>
								</Text>
							</View>
							{timer.status === "done" ? null : (
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={toggleLabel}
									onPress={() => {
										if (timer.status === "paused") {
											void resumeCookTimer(timer.id);
											return;
										}
										void pauseCookTimer(timer.id);
									}}
									style={[
										styles.trayButton,
										{ backgroundColor: colors.background },
									]}
								>
									<Text
										style={[
											styles.trayButtonText,
											{ color: colors.foreground },
										]}
									>
										{toggleLabel}
									</Text>
								</Pressable>
							)}
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={copy.recipe.timerAdd}
								onPress={() => void addCookMinute(timer.id)}
								style={[
									styles.trayButton,
									{ backgroundColor: colors.background },
								]}
							>
								<Text
									style={[
										styles.trayButtonText,
										{ color: colors.foreground },
									]}
								>
									{copy.recipe.timerAdd}
								</Text>
							</Pressable>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={copy.recipe.timerCancel}
								onPress={() => void cancelCookTimer(timer.id)}
								hitSlop={6}
							>
								<X color={colors.mutedForeground} size={20} />
							</Pressable>
						</View>
					);
				})}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	header: {
		minHeight: 64,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},
	headerText: {
		fontFamily: fonts.body,
		fontSize: 18,
	},
	headerNav: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	banner: {
		marginHorizontal: 20,
		marginBottom: 8,
		borderRadius: 999,
		paddingVertical: 10,
		paddingHorizontal: 16,
		alignItems: "center",
	},
	bannerText: {
		fontFamily: fonts.label,
		fontSize: 16,
	},
	stage: {
		flex: 1,
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
	stepBlock: {
		paddingVertical: 28,
	},
	stepLabel: {
		fontFamily: fonts.label,
		fontSize: 13,
		letterSpacing: 1.4,
		textTransform: "uppercase",
		marginBottom: 10,
	},
	copy: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
	},
	chip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 4,
		marginHorizontal: 3,
		marginVertical: 2,
	},
	inlineIcon: {
		width: 28,
		height: 28,
		borderRadius: 6,
	},
	sideScroll: {
		width: 320,
		marginLeft: 24,
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
	floatWrap: {
		position: "absolute",
		top: 8,
		alignItems: "center",
		zIndex: 20,
	},
	trayScroll: {
		maxHeight: 220,
		width: "100%",
	},
	trayList: {
		gap: 8,
		alignItems: "center",
	},
	trayRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		minHeight: 44,
		maxWidth: "100%",
		borderRadius: 999,
		paddingVertical: 6,
		paddingLeft: 12,
		paddingRight: 8,
		shadowColor: "#1A1D14",
		shadowOpacity: 0.16,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 6 },
		elevation: 4,
	},
	trayCopy: {
		flexShrink: 1,
		minWidth: 0,
	},
	trayTime: {
		fontFamily: fonts.label,
		fontSize: 18,
	},
	trayLabel: {
		fontFamily: fonts.body,
		fontSize: 14,
	},
	trayButton: {
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	trayButtonText: {
		fontFamily: fonts.label,
		fontSize: 14,
	},
});
