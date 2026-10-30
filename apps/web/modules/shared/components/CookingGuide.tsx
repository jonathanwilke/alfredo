"use client";

import { api } from "@shared/lib/api";
import {
	addCookMinute,
	cancelCookTimer,
	pauseCookTimer,
	remainingSeconds,
	resumeCookTimer,
	startCookTimer,
	useTimerAlert,
	useTimerClock,
} from "@shared/lib/cook-timers";
import { ChevronDown, ChevronUp, Timer, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
	decorateStep,
	ingredientIconKey,
	type StepIngredient,
	type StepPiece,
} from "./highlight-step";

interface CookingStep {
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

export function CookingGuide({
	recipeId,
	steps,
	onExit,
}: {
	recipeId: string;
	steps: CookingStep[];
	onExit: () => void;
}) {
	const t = useTranslations("recipe");
	const locale = useLocale();
	const { timers, now } = useTimerClock();
	const alert = useTimerAlert();
	const [index, setIndex] = useState(0);
	const [banner, setBanner] = useState<string | null>(null);
	const [iconsByKey, setIconsByKey] = useState<Record<string, string>>({});
	const scrollerRef = useRef<HTMLDivElement>(null);
	const stepRefs = useRef<(HTMLElement | null)[]>([]);
	const focusing = useRef(false);
	const step = steps[index];

	useEffect(() => {
		let stopped = false;
		let timer = 0;

		async function load() {
			const result = await api.icons.list({ recipeId });
			if (stopped) {
				return;
			}
			const ready: Record<string, string> = {};
			for (const icon of result.ingredients) {
				if (icon.status === "ready" && icon.url) {
					ready[icon.key] = icon.url;
				}
			}
			setIconsByKey(ready);
			if (result.ingredients.some((icon) => icon.status === "pending")) {
				timer = window.setTimeout(() => {
					void load();
				}, 2000);
			}
		}

		void load();
		return () => {
			stopped = true;
			window.clearTimeout(timer);
		};
	}, [recipeId]);

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
		if (!scroller || focusing.current) {
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
		<main className="dark flex h-dvh flex-col overflow-hidden bg-background text-foreground">
			<header className="flex shrink-0 items-center justify-between gap-4 px-5 py-5 sm:px-8">
				<button type="button" onClick={onExit} className="text-lg">
					{t("overview")}
				</button>
				<div className="flex items-center gap-2">
					<button
						type="button"
						aria-label={t("previous")}
						disabled={index === 0}
						onClick={() => focusStep(Math.max(0, index - 1))}
						className="disabled:opacity-50"
					>
						<ChevronUp aria-hidden className="size-7" />
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
						className="disabled:opacity-50"
					>
						<ChevronDown aria-hidden className="size-7" />
					</button>
				</div>
			</header>
			{banner ? (
				<p
					role="alert"
					className="mx-5 mb-2 rounded-full bg-timer px-4 py-2 text-center font-semibold text-background sm:mx-8"
				>
					{t("timerDone")}
				</p>
			) : null}
			<div className="relative flex min-h-0 flex-1">
				<TimerTray timers={timers} now={now} />
				<div className="flex min-h-0 flex-1">
					<aside className="hidden w-80 shrink-0 overflow-y-auto border-r border-border px-6 py-8 lg:block">
						<h2 className="font-heading text-3xl">
							{t("stepIngredients")}
						</h2>
						{step.ingredients.length === 0 ? (
							<p className="mt-4 text-lg text-muted-foreground">
								—
							</p>
						) : (
							<ul className="mt-5 flex flex-col gap-4">
								{step.ingredients.map((ingredient) => {
									const key = ingredient.canonicalKey
										? ingredientIconKey(
												ingredient.canonicalKey,
											)
										: null;
									const iconUrl = key
										? iconsByKey[key]
										: null;
									const amount = [
										ingredient.scaledQuantity,
										ingredient.scaledUnit ??
											ingredient.unit,
									]
										.filter(Boolean)
										.join(" ");
									return (
										<li
											key={ingredient.id}
											className="flex items-center gap-3"
										>
											{iconUrl ? (
												// biome-ignore lint/performance/noImgElement: icon URLs are stored objects, not next/image assets
												<img
													src={iconUrl}
													alt=""
													className="size-12 rounded-2xl object-cover"
												/>
											) : (
												<span className="size-12 rounded-2xl bg-accent" />
											)}
											<span className="min-w-0">
												<span className="block text-lg">
													{ingredient.name}
												</span>
												{amount ? (
													<span className="block text-base text-muted-foreground">
														{amount}
													</span>
												) : null}
											</span>
										</li>
									);
								})}
							</ul>
						)}
					</aside>
					<div
						ref={scrollerRef}
						onScroll={updateActive}
						className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-8"
					>
						<div className="mx-auto w-full max-w-3xl pt-[12vh] pb-[62vh]">
							{steps.map((item, stepIndex) => {
								const distance = Math.abs(index - stepIndex);
								return (
									// biome-ignore lint/a11y/useKeyWithClickEvents: arrow keys and the step label handle the keyboard
									<article
										key={item.id}
										ref={(element) => {
											stepRefs.current[stepIndex] =
												element;
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
											className="mb-3 font-sans text-[13px] font-semibold tracking-[0.14em] uppercase"
										>
											{t("stepLabel", {
												step: stepIndex + 1,
											})}
										</button>
										<StepCopy
											step={item}
											locale={locale}
											iconsByKey={iconsByKey}
											alertBody={t("timerDone")}
											stepIndex={stepIndex}
										/>
									</article>
								);
							})}
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}

function StepCopy({
	step,
	locale,
	iconsByKey,
	alertBody,
	stepIndex,
}: {
	step: CookingStep;
	locale: string;
	iconsByKey: Record<string, string>;
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
					iconsByKey={iconsByKey}
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
	iconsByKey,
	alertBody,
}: {
	piece: StepPiece;
	stepId: string;
	stepIndex: number;
	iconsByKey: Record<string, string>;
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
				className={`mx-[0.12em] inline-flex cursor-pointer items-center gap-[0.2em] rounded-full border-0 px-[0.35em] py-[0.02em] align-baseline font-semibold text-[0.72em] text-timer ${running ? "bg-timer/25" : "bg-timer/10"}`}
			>
				<Timer
					aria-hidden
					strokeWidth={2.25}
					className="size-[0.9em]"
				/>
				{piece.text}
			</button>
		);
	}

	const iconKey = piece.ingredient?.canonicalKey
		? ingredientIconKey(piece.ingredient.canonicalKey)
		: null;
	const iconUrl = iconKey ? iconsByKey[iconKey] : null;
	const emphasized = Boolean(piece.ingredient || piece.emphasis);

	return (
		<span className={emphasized ? "font-semibold" : undefined}>
			{iconUrl ? (
				// biome-ignore lint/performance/noImgElement: icon URLs are stored objects, not next/image assets
				<img
					src={iconUrl}
					alt=""
					className="mr-[0.15em] inline-block size-[1.05em] rounded-[0.25em] object-cover align-[-0.15em]"
				/>
			) : null}
			{piece.text}
		</span>
	);
}

function TimerTray({
	timers,
	now,
}: {
	timers: ReturnType<typeof useTimerClock>["timers"];
	now: number;
}) {
	const t = useTranslations("recipe");
	if (timers.length === 0) {
		return null;
	}
	return (
		<div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-4">
			<ul className="pointer-events-auto flex max-h-[46vh] w-max max-w-full flex-col items-center gap-2 overflow-y-auto">
				{timers.map((timer) => {
					const remaining = remainingSeconds(timer, now);
					const clock =
						timer.status === "done"
							? t("timerDone")
							: formatClock(remaining);
					const toggle =
						timer.status === "paused"
							? t("timerResume")
							: t("timerPause");
					return (
						<li
							key={timer.id}
							className="flex items-center gap-2 rounded-full bg-timer/10 px-3 py-1.5 text-timer shadow-lg"
						>
							<Timer
								aria-hidden
								strokeWidth={2.25}
								className="size-5 shrink-0"
							/>
							<p className="min-w-0 font-semibold text-lg tabular-nums">
								{clock}
								<span className="ml-2 font-normal text-base text-foreground/80">
									{timer.label}
								</span>
							</p>
							{timer.status === "done" ? null : (
								<button
									type="button"
									onClick={() => {
										if (timer.status === "paused") {
											resumeCookTimer(timer.id);
											return;
										}
										pauseCookTimer(timer.id);
									}}
									className="rounded-full bg-background/70 px-3 py-1 font-semibold text-sm text-foreground"
								>
									{toggle}
								</button>
							)}
							<button
								type="button"
								onClick={() => addCookMinute(timer.id)}
								className="rounded-full bg-background/70 px-3 py-1 font-semibold text-sm text-foreground"
							>
								{t("timerAdd")}
							</button>
							<button
								type="button"
								aria-label={t("timerCancel")}
								onClick={() => cancelCookTimer(timer.id)}
								className="grid size-8 place-items-center rounded-full text-foreground/80"
							>
								<X aria-hidden className="size-5" />
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
