"use client";

import {
	Cancel01Icon,
	ChevronDownIcon,
	ChevronUpIcon,
	PauseIcon,
	PlayIcon,
	Timer01Icon,
} from "@hugeicons/core-free-icons";
import {
	cancelCookTimer,
	pauseCookTimer,
	remainingSeconds,
	resumeCookTimer,
	startCookTimer,
	useTimerAlert,
	useTimerClock,
} from "@shared/lib/cook-timers";
import { optimizableImage } from "@shared/lib/optimizable-image";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { parseAsInteger, useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";
import {
	decorateStep,
	type StepIngredient,
	type StepPiece,
} from "./highlight-step";
import { Icon } from "./Icon";
import { DishImage } from "./RecipeIcons";

interface CookingStep {
	id: string;
	text: string;
	ingredients: StepIngredient[];
	line: string | null;
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
	return [
		...pieces,
		{
			text: fallbackDuration(step.timerSeconds, locale),
			ingredient: null,
			timer: true,
			timerSeconds: step.timerSeconds,
			sourceStart: step.text.length,
			sourceEnd: step.text.length,
		} satisfies StepPiece,
	];
}

function stepIndexFromParam(value: number | null, count: number) {
	if (value == null || count <= 0) {
		return 0;
	}
	return Math.min(count - 1, Math.max(0, value - 1));
}

export function CookingGuide({
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
	const t = useTranslations("recipe");
	const locale = useLocale();
	const { timers, now } = useTimerClock();
	const alert = useTimerAlert();
	const [stepParam, setStepParam] = useQueryState(
		"step",
		parseAsInteger.withOptions({ history: "replace" }),
	);
	const [index, setIndex] = useState(() =>
		stepIndexFromParam(stepParam, steps.length),
	);
	const [banner, setBanner] = useState<string | null>(null);
	const [atEnd, setAtEnd] = useState(false);
	const scrollerRef = useRef<HTMLDivElement>(null);
	const stepRefs = useRef<(HTMLElement | null)[]>([]);
	const focusing = useRef(false);
	const restored = useRef(false);
	const step = steps[index];

	useEffect(() => {
		const number = index + 1;
		if ((stepParam ?? 1) === number) {
			return;
		}
		void setStepParam(number === 1 ? null : number);
	}, [index, setStepParam, stepParam]);

	useEffect(() => {
		if (restored.current) {
			return;
		}
		restored.current = true;
		if (index > 0) {
			focusStep(index);
		}
	}, [index]);

	useEffect(() => {
		let lock: WakeLockSentinel | null = null;

		async function acquire() {
			try {
				if (!("wakeLock" in navigator)) {
					return;
				}
				lock = await navigator.wakeLock.request("screen");
			} catch {
				lock = null;
			}
		}

		function onVisible() {
			if (document.visibilityState === "visible" && !lock) {
				void acquire();
			}
		}

		void acquire();
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			document.removeEventListener("visibilitychange", onVisible);
			void lock?.release();
		};
	}, []);

	useEffect(() => {
		if (!alert) {
			return;
		}
		setBanner(alert.label);
		const timeout = window.setTimeout(() => {
			setBanner((current) => (current === alert.label ? null : current));
		}, 4000);
		return () => window.clearTimeout(timeout);
	}, [alert]);

	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			const target = event.target;
			if (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement
			) {
				return;
			}
			if (event.key === "ArrowDown" || event.key === "ArrowRight") {
				event.preventDefault();
				focusStep(Math.min(steps.length - 1, index + 1));
			}
			if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
				event.preventDefault();
				focusStep(Math.max(0, index - 1));
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [index, steps.length]);

	function updateActive() {
		const scroller = scrollerRef.current;
		if (!scroller) {
			return;
		}
		const atEndNow =
			scroller.scrollTop > 48 &&
			scroller.scrollTop + scroller.clientHeight >=
				scroller.scrollHeight - 48;
		setAtEnd((current) => (current === atEndNow ? current : atEndNow));
		if (focusing.current) {
			return;
		}
		const root = scroller.getBoundingClientRect();
		const focus = root.top + root.height * 0.32;
		let best = 0;
		let bestDistance = Number.POSITIVE_INFINITY;
		stepRefs.current.forEach((element, stepIndex) => {
			if (!element) {
				return;
			}
			const box = element.getBoundingClientRect();
			const distance = Math.abs(box.top + box.height / 2 - focus);
			if (distance < bestDistance) {
				best = stepIndex;
				bestDistance = distance;
			}
		});
		setIndex((current) => (current === best ? current : best));
	}

	function focusStep(next: number) {
		const element = stepRefs.current[next];
		if (!element) {
			setIndex(next);
			return;
		}
		focusing.current = true;
		setIndex(next);
		const reduce = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		element.scrollIntoView({
			behavior: reduce ? "auto" : "smooth",
			block: "start",
		});
		window.setTimeout(
			() => {
				focusing.current = false;
			},
			reduce ? 0 : 450,
		);
	}

	if (!step) {
		return null;
	}

	return (
		<main className="dark relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
			<header className="relative z-40 flex shrink-0 items-center justify-center bg-background px-5 py-4 sm:px-8">
				<button
					type="button"
					onClick={onExit}
					className="flex min-w-0 max-w-full cursor-pointer items-center gap-3 border-0 bg-transparent p-0"
				>
					{imageUrl && optimizableImage(imageUrl) ? (
						<Image
							src={imageUrl}
							alt=""
							width={72}
							height={72}
							sizes="36px"
							className="size-9 shrink-0 rounded-lg object-cover"
						/>
					) : imageUrl ? (
						// biome-ignore lint/performance/noImgElement: this host is outside the image optimizer
						<img
							src={imageUrl}
							alt=""
							className="size-9 shrink-0 rounded-lg object-cover"
						/>
					) : null}
					<span className="min-w-0 truncate font-heading text-xl leading-tight">
						{title}
					</span>
				</button>
			</header>
			{banner ? (
				<p
					role="alert"
					className="mx-5 mb-2 rounded-full bg-timer px-4 py-2 text-center font-semibold text-background sm:mx-8"
				>
					{t("timerDone")}
				</p>
			) : null}
			<div className="relative z-0 flex min-h-0 flex-1">
				<TimerTray timers={timers} now={now} onShowStep={focusStep} />
				<div
					ref={scrollerRef}
					onScroll={updateActive}
					className="min-h-0 flex-1 overflow-y-auto px-5 [mask-image:linear-gradient(to_bottom,transparent,#000_4.5rem,#000_calc(100%_-_8rem),transparent)] [mask-repeat:no-repeat] [mask-size:100%_100%] [-webkit-mask-image:linear-gradient(to_bottom,transparent,#000_4.5rem,#000_calc(100%_-_8rem),transparent)] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:100%_100%] sm:px-8"
				>
					<div className="mx-auto w-full max-w-3xl pt-[12vh] pb-24">
						{steps.map((item, stepIndex) => {
							const distance = Math.abs(index - stepIndex);
							return (
								// biome-ignore lint/a11y/useKeyWithClickEvents: arrow keys and the step label handle the keyboard
								<article
									key={item.id}
									ref={(element) => {
										stepRefs.current[stepIndex] = element;
									}}
									onClick={() => focusStep(stepIndex)}
									className="scroll-mt-[18vh] cursor-pointer py-8 transition-opacity duration-300 motion-reduce:transition-none"
									style={{
										opacity: distance === 0 ? 1 : 0.32,
									}}
								>
									<button
										type="button"
										onClick={() => focusStep(stepIndex)}
										className="font-sans text-[13px] font-semibold tracking-[0.14em] uppercase"
									>
										{t("stepLabel", {
											step: stepIndex + 1,
										})}
									</button>
									{item.line ? (
										<p
											title={item.line}
											className="mt-1 mb-3 truncate text-sm text-muted-foreground"
										>
											{item.line}
										</p>
									) : (
										<div className="mb-3" />
									)}
									<StepCopy
										step={item}
										locale={locale}
										alertBody={t("timerDone")}
										stepIndex={stepIndex}
									/>
								</article>
							);
						})}
						{imageUrl ? (
							<div className="py-8">
								<DishImage
									status="ready"
									url={imageUrl}
									label={title}
									loading="lazy"
									sizes="(min-width: 768px) 720px, 100vw"
								/>
							</div>
						) : null}
					</div>
				</div>
			</div>
			<div
				className={`pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center transition-opacity duration-300 motion-reduce:transition-none ${atEnd ? "opacity-0" : "opacity-100"}`}
			>
				<div
					inert={atEnd}
					className={`flex items-center gap-1 rounded-full bg-muted px-2 py-1 ${atEnd ? "pointer-events-none" : "pointer-events-auto"}`}
				>
					<button
						type="button"
						aria-label={t("previous")}
						disabled={index === 0}
						onClick={() => focusStep(Math.max(0, index - 1))}
						className="grid size-11 place-items-center disabled:opacity-35"
					>
						<Icon icon={ChevronUpIcon} size={28} aria-hidden />
					</button>
					<p className="text-lg tabular-nums">
						{t("progress", {
							current: index + 1,
							total: steps.length,
						})}
					</p>
					<button
						type="button"
						aria-label={t("next")}
						disabled={index === steps.length - 1}
						onClick={() =>
							focusStep(Math.min(steps.length - 1, index + 1))
						}
						className="grid size-11 place-items-center disabled:opacity-35"
					>
						<Icon icon={ChevronDownIcon} size={28} aria-hidden />
					</button>
				</div>
			</div>
		</main>
	);
}

function StepCopy({
	step,
	locale,
	alertBody,
	stepIndex,
}: {
	step: CookingStep;
	locale: string;
	alertBody: string;
	stepIndex: number;
}) {
	const pieces = piecesFor(step, locale);
	return (
		<p className="font-sans text-[30px] leading-[1.35] lg:text-[40px] lg:leading-[1.3]">
			{pieces.map((piece, pieceIndex) => (
				<StepFragment
					key={`${piece.sourceStart}-${pieceIndex}`}
					piece={piece}
					stepId={step.id}
					stepIndex={stepIndex}
					alertBody={alertBody}
				/>
			))}
		</p>
	);
}

function StepFragment({
	piece,
	stepId,
	stepIndex,
	alertBody,
}: {
	piece: StepPiece;
	stepId: string;
	stepIndex: number;
	alertBody: string;
}) {
	const { timers } = useTimerClock();
	if (piece.timer && piece.timerSeconds) {
		const id = `${stepId}:${piece.sourceStart}`;
		const running = timers.some(
			(timer) => timer.id === id && timer.status !== "done",
		);
		return (
			<button
				type="button"
				onClick={(event) => {
					event.stopPropagation();
					startCookTimer({
						id,
						label: piece.text,
						stepIndex,
						seconds: piece.timerSeconds ?? 0,
						alertBody: `${alertBody} · ${piece.text}`,
					});
				}}
				className={`mx-[0.12em] inline-flex cursor-pointer items-center gap-[0.28em] rounded-full border-0 px-[0.4em] py-[0.02em] align-baseline font-semibold text-[0.72em] text-timer ${running ? "bg-timer/25" : "bg-timer/10"}`}
			>
				<Icon
					icon={Timer01Icon}
					aria-hidden
					className="size-[1.05em] shrink-0"
				/>
				{piece.text}
			</button>
		);
	}

	const emphasized = Boolean(piece.ingredient || piece.emphasis);

	return (
		<span className={emphasized ? "font-semibold" : undefined}>
			{piece.text}
		</span>
	);
}

function TimerTray({
	timers,
	now,
	onShowStep,
}: {
	timers: ReturnType<typeof useTimerClock>["timers"];
	now: number;
	onShowStep: (stepIndex: number) => void;
}) {
	const t = useTranslations("recipe");
	if (timers.length === 0) {
		return null;
	}
	return (
		<div className="pointer-events-none absolute inset-x-0 top-3 z-50 flex justify-center px-4">
			<ul className="pointer-events-auto flex w-full max-w-full flex-row flex-wrap items-center justify-center gap-2">
				{timers.map((timer) => {
					const remaining = remainingSeconds(timer, now);
					const clock =
						timer.status === "done"
							? t("timerDone")
							: formatClock(remaining);
					const paused = timer.status === "paused";
					const toggle = paused ? t("timerResume") : t("timerPause");
					return (
						<li
							key={timer.id}
							className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-timer"
							style={{
								backgroundColor:
									"color-mix(in srgb, var(--timer) 18%, #f3ede3)",
							}}
						>
							<Icon
								icon={Timer01Icon}
								aria-hidden
								className="shrink-0"
							/>
							<button
								type="button"
								aria-label={t("stepLabel", {
									step: timer.stepIndex + 1,
								})}
								onClick={() => onShowStep(timer.stepIndex)}
								className="min-w-0 cursor-pointer font-semibold text-lg tabular-nums"
							>
								{clock}
							</button>
							{timer.status === "done" ? null : (
								<button
									type="button"
									aria-label={toggle}
									onClick={() => {
										if (paused) {
											resumeCookTimer(timer.id);
											return;
										}
										pauseCookTimer(timer.id);
									}}
									className="grid size-8 place-items-center text-foreground"
								>
									<Icon
										icon={paused ? PlayIcon : PauseIcon}
										aria-hidden
									/>
								</button>
							)}
							<button
								type="button"
								aria-label={t("timerCancel")}
								onClick={() => cancelCookTimer(timer.id)}
								className="grid size-8 place-items-center text-foreground/80"
							>
								<Icon icon={Cancel01Icon} aria-hidden />
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
