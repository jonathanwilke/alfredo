import {
	Cancel01Icon,
	ChevronDownIcon,
	ChevronUpIcon,
	PauseIcon,
	PlayIcon,
	Timer01Icon,
} from "@hugeicons/core-free-icons";
import { Image } from "expo-image";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
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
	type StepIngredient,
	type StepPiece,
} from "@/lib/highlight-step";
import { useLayout } from "@/lib/layout";
import {
	cancelCookTimer,
	pauseCookTimer,
	remainingSeconds,
	resumeCookTimer,
	startCookTimer,
	useCookTimers,
	useTimerAlert,
	useTimerClock,
} from "@/lib/timers";
import { fonts, palettes, radii } from "@/theme/tokens";
import { Icon } from "./Icon";

const KEEP_AWAKE = "cooking";
const colors = palettes.dark;

export interface CookingStep {
	id: string;
	text: string;
	ingredients: StepIngredient[];
	line: string | null;
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
	title,
	imageUrl,
	steps,
	onExit,
}: {
	title: string;
	imageUrl?: string | null;
	steps: CookingStep[];
	onExit: () => void;
}) {
	const { copy, locale } = useI18n();
	const { pagePadding, isTablet } = useLayout();
	const insets = useSafeAreaInsets();
	const { timers, now } = useTimerClock();
	const alert = useTimerAlert();
	const [index, setIndex] = useState(0);
	const [viewport, setViewport] = useState(0);
	const [banner, setBanner] = useState<string | null>(null);
	const [atEnd, setAtEnd] = useState(false);
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
				style={{
					paddingTop: Math.max(insets.top, 12),
					paddingHorizontal: pagePadding,
					zIndex: 2,
					elevation: 12,
				}}
			>
				<View style={styles.header}>
					<Pressable
						accessibilityRole="button"
						onPress={onExit}
						style={styles.titleButton}
					>
						{imageUrl ? (
							<Image
								source={{ uri: imageUrl }}
								style={styles.thumb}
								contentFit="cover"
								accessibilityIgnoresInvertColors
							/>
						) : null}
						<Text
							numberOfLines={1}
							style={[styles.title, { color: colors.foreground }]}
						>
							{title}
						</Text>
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
				<View style={styles.body}>
					<ScrollView
						ref={scrollRef}
						style={styles.stepScroll}
						onLayout={(event) =>
							setViewport(event.nativeEvent.layout.height)
						}
						scrollEventThrottle={16}
						onScroll={(event) => {
							const {
								contentOffset,
								layoutMeasurement,
								contentSize,
							} = event.nativeEvent;
							const atEndNow =
								contentOffset.y > 48 &&
								contentOffset.y + layoutMeasurement.height >=
									contentSize.height - 48;
							setAtEnd((current) =>
								current === atEndNow ? current : atEndNow,
							);
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
							paddingBottom: 88 + Math.max(insets.bottom, 16),
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
								onFocus={focusStep}
								onLayout={(layout) => {
									layouts.current[stepIndex] = layout;
								}}
							/>
						))}
						{imageUrl ? (
							<View
								accessibilityRole="image"
								accessibilityLabel={title}
								style={styles.dish}
							>
								<Image
									source={{ uri: imageUrl }}
									style={styles.dishPhoto}
									contentFit="cover"
									accessibilityIgnoresInvertColors
								/>
							</View>
						) : null}
					</ScrollView>
					<LinearGradient
						pointerEvents="none"
						colors={[colors.background, `${colors.background}00`]}
						style={styles.fadeTop}
					/>
					<LinearGradient
						pointerEvents="none"
						colors={[`${colors.background}00`, colors.background]}
						style={styles.fadeBottom}
					/>
				</View>
				<TimerTray
					timers={timers}
					now={now}
					inset={pagePadding}
					onShowStep={focusStep}
				/>
			</View>
			<View
				pointerEvents={atEnd ? "none" : "box-none"}
				style={[
					styles.stepNav,
					{
						bottom: Math.max(insets.bottom, 16),
						opacity: atEnd ? 0 : 1,
					},
				]}
			>
				<View
					style={[
						styles.stepNavBar,
						{ backgroundColor: colors.muted },
					]}
				>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={copy.recipe.previous}
						disabled={index === 0}
						onPress={() => focusStep(Math.max(0, index - 1))}
						hitSlop={8}
						style={[
							styles.stepNavButton,
							{ opacity: index === 0 ? 0.35 : 1 },
						]}
					>
						<Icon
							icon={ChevronUpIcon}
							color={colors.foreground}
							size={26}
						/>
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
						style={[
							styles.stepNavButton,
							{
								opacity: index === steps.length - 1 ? 0.35 : 1,
							},
						]}
					>
						<Icon
							icon={ChevronDownIcon}
							color={colors.foreground}
							size={26}
						/>
					</Pressable>
				</View>
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
				style={{ marginBottom: step.line ? 0 : 10 }}
			>
				<Text style={[styles.stepLabel, { color: colors.foreground }]}>
					{label}
				</Text>
				{step.line ? (
					<Text
						style={[
							styles.stepIngredients,
							{ color: colors.mutedForeground },
						]}
					>
						{step.line}
					</Text>
				) : null}
			</Pressable>
			<StepCopy
				pieces={pieces}
				fontSize={fontSize}
				lineHeight={lineHeight}
				stepId={step.id}
				stepIndex={index}
				alertBody={alertBody}
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
	onFocus,
}: {
	pieces: StepPiece[];
	fontSize: number;
	lineHeight: number;
	stepId: string;
	stepIndex: number;
	alertBody: string;
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
			<Icon
				icon={Timer01Icon}
				color={colors.timer}
				size={Math.round(fontSize * 0.72)}
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

function TimerTray({
	timers,
	now,
	inset,
	onShowStep,
}: {
	timers: ReturnType<typeof useTimerClock>["timers"];
	now: number;
	inset: number;
	onShowStep: (stepIndex: number) => void;
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
			<View style={styles.trayList}>
				{timers.map((timer) => {
					const remaining = remainingSeconds(timer, now);
					const clock =
						timer.status === "done"
							? copy.recipe.timerDone
							: formatClock(remaining);
					const paused = timer.status === "paused";
					const toggleLabel = paused
						? copy.recipe.timerResume
						: copy.recipe.timerPause;
					return (
						<View key={timer.id} style={styles.trayRow}>
							<Icon icon={Timer01Icon} color={colors.timer} />
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={copy.recipe.stepLabel(
									timer.stepIndex + 1,
								)}
								hitSlop={8}
								onPress={() => onShowStep(timer.stepIndex)}
							>
								<Text
									style={[
										styles.trayTime,
										{ color: colors.timer },
									]}
								>
									{clock}
								</Text>
							</Pressable>
							{timer.status === "done" ? null : (
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={toggleLabel}
									hitSlop={8}
									onPress={() => {
										if (paused) {
											void resumeCookTimer(timer.id);
											return;
										}
										void pauseCookTimer(timer.id);
									}}
								>
									<Icon
										icon={paused ? PlayIcon : PauseIcon}
										color={colors.foreground}
									/>
								</Pressable>
							)}
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={copy.recipe.timerCancel}
								onPress={() => void cancelCookTimer(timer.id)}
								hitSlop={6}
							>
								<Icon
									icon={Cancel01Icon}
									color={colors.mutedForeground}
								/>
							</Pressable>
						</View>
					);
				})}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	header: {
		minHeight: 64,
		alignItems: "center",
		justifyContent: "center",
	},
	headerText: {
		fontFamily: fonts.body,
		fontSize: 18,
	},
	titleButton: {
		maxWidth: "100%",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
	},
	title: {
		flexShrink: 1,
		fontFamily: fonts.display,
		fontSize: 20,
		lineHeight: 24,
	},
	thumb: {
		width: 36,
		height: 36,
		borderRadius: 8,
	},
	stepNav: {
		position: "absolute",
		left: 0,
		right: 0,
		alignItems: "center",
		zIndex: 2,
	},
	stepNavBar: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		borderRadius: 999,
		paddingHorizontal: 8,
		paddingVertical: 4,
		elevation: 8,
	},
	stepNavButton: {
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
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
		zIndex: 0,
	},
	body: {
		flex: 1,
	},
	stepScroll: {
		flex: 1,
	},
	fadeTop: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 72,
		zIndex: 1,
	},
	fadeBottom: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		height: 140,
		zIndex: 1,
	},
	dish: {
		marginVertical: 28,
		width: "100%",
		aspectRatio: 16 / 9,
		borderRadius: radii.icon,
		backgroundColor: colors.muted,
		overflow: "hidden",
		shadowColor: "#40442A",
		shadowOffset: { width: 0, height: 14 },
		shadowOpacity: 0.28,
		shadowRadius: 18,
		elevation: 3,
	},
	dishPhoto: {
		width: "100%",
		height: "100%",
	},
	stepBlock: {
		paddingVertical: 28,
	},
	stepLabel: {
		fontFamily: fonts.label,
		fontSize: 13,
		letterSpacing: 1.4,
		textTransform: "uppercase",
	},
	stepIngredients: {
		fontFamily: fonts.body,
		fontSize: 14,
		lineHeight: 20,
		marginTop: 4,
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
	floatWrap: {
		position: "absolute",
		top: 8,
		alignItems: "center",
		zIndex: 2,
		elevation: 6,
	},
	trayList: {
		width: "100%",
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: 8,
	},
	trayRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		minHeight: 44,
		maxWidth: "100%",
		borderRadius: 999,
		paddingHorizontal: 10,
		backgroundColor: "#F2DDC5",
	},
	trayTime: {
		fontFamily: fonts.label,
		fontSize: 18,
	},
});
