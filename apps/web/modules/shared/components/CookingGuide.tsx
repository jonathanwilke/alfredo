"use client";

import { api } from "@shared/lib/api";
import { Button } from "@ui/components/button";
import { Timer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
	findDuration,
	findEmphasis,
	highlightStep,
	ingredientIconKey,
	placeDuration,
	placeEmphasis,
	type StepIngredient,
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

function secondsLeft(endsAt: number, now: number) {
	return Math.max(0, Math.ceil((endsAt - now) / 1000));
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
	const [index, setIndex] = useState(0);
	const [now, setNow] = useState(() => Date.now());
	const [running, setRunning] = useState<{
		stepIndex: number;
		endsAt: number;
	} | null>(null);
	const [iconsByKey, setIconsByKey] = useState<Record<string, string>>({});
	const step = steps[index];
	const isLast = index === steps.length - 1;

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
		if (!running || running.endsAt <= Date.now()) {
			return;
		}

		const timer = window.setInterval(() => {
			const next = Date.now();
			setNow(next);
			if (next >= running.endsAt) {
				window.clearInterval(timer);
			}
		}, 1000);

		return () => window.clearInterval(timer);
	}, [running]);

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
	const onTimerStep = running?.stepIndex === index;
	const remaining =
		running && onTimerStep ? secondsLeft(running.endsAt, now) : null;
	const timerLabel =
		remaining == null
			? null
			: remaining === 0
				? t("timerDone")
				: formatClock(remaining);
	const floating =
		running != null && running.stepIndex !== index
			? secondsLeft(running.endsAt, now)
			: null;

	function startTimer() {
		if (step?.timerSeconds == null) {
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

	return (
		<main className="dark flex min-h-screen flex-col bg-background text-foreground">
			<header className="sticky top-0 z-20 grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-background px-5 py-6 sm:px-8">
				<button
					type="button"
					onClick={onExit}
					className="justify-self-start text-lg text-foreground"
				>
					{t("overview")}
				</button>
				{floating == null || running == null ? (
					<span />
				) : (
					<button
						type="button"
						onClick={() => setIndex(running.stepIndex)}
						aria-label={t("timerReturn")}
						className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-timer/10 px-4 py-2 font-semibold text-lg text-timer tabular-nums transition-colors hover:bg-timer/20"
					>
						<Timer
							aria-hidden
							strokeWidth={2.25}
							className="size-5"
						/>
						{floating === 0
							? t("timerDone")
							: formatClock(floating)}
					</button>
				)}
				<p className="justify-self-end text-lg tabular-nums">
					{t("progress", { current: index + 1, total: steps.length })}
				</p>
			</header>
			<div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 px-5 py-8 sm:px-8">
				<p className="text-3xl leading-snug sm:text-4xl">
					{pieces.map((piece, pieceIndex) => {
						if (piece.timer) {
							return (
								<button
									key={`timer-${pieceIndex}`}
									type="button"
									onClick={startTimer}
									className="inline cursor-pointer rounded-[0.3em] border-0 bg-timer/10 px-[0.28em] py-[0.02em] font-semibold text-timer transition-colors hover:bg-timer/20"
								>
									<Timer
										aria-hidden
										strokeWidth={2.25}
										className="mr-[0.15em] inline size-[0.85em] align-[-0.1em]"
									/>
									{timerLabel ?? piece.text}
								</button>
							);
						}

						if (piece.emphasis) {
							return (
								<strong
									key={`emphasis-${pieceIndex}`}
									className="font-semibold"
								>
									{piece.text}
								</strong>
							);
						}

						if (!piece.ingredient) {
							return piece.text;
						}

						const iconKey = piece.ingredient.canonicalKey
							? ingredientIconKey(piece.ingredient.canonicalKey)
							: null;
						const iconUrl = iconKey ? iconsByKey[iconKey] : null;

						return (
							<strong
								key={`${piece.ingredient.id}-${pieceIndex}`}
								className="font-semibold"
							>
								{iconUrl ? (
									// biome-ignore lint/performance/noImgElement: icon URLs are stored objects, not next/image assets
									<img
										src={iconUrl}
										alt=""
										className="mr-[0.15em] inline-block size-[1.1em] rounded-[0.25em] object-cover align-[-0.15em]"
									/>
								) : null}
								{piece.text}
							</strong>
						);
					})}
					{step.timerSeconds != null &&
					!pieces.some((piece) => piece.timer) ? (
						<>
							{" "}
							<button
								type="button"
								onClick={startTimer}
								className="inline cursor-pointer rounded-[0.3em] border-0 bg-timer/10 px-[0.28em] py-[0.02em] font-semibold text-timer transition-colors hover:bg-timer/20"
							>
								<Timer
									aria-hidden
									strokeWidth={2.25}
									className="mr-[0.15em] inline size-[0.85em] align-[-0.1em]"
								/>
								{timerLabel ??
									fallbackDuration(step.timerSeconds)}
							</button>
						</>
					) : null}
				</p>
			</div>
			<div className="mx-auto flex w-full max-w-5xl gap-3 px-5 pb-8 sm:px-8">
				{index > 0 ? (
					<Button
						type="button"
						variant="outline"
						onClick={() => setIndex((current) => current - 1)}
						className="h-16 rounded-full px-6 text-lg"
					>
						{t("previous")}
					</Button>
				) : null}
				<Button
					type="button"
					variant="primary"
					onClick={() => {
						if (isLast) {
							onExit();
							return;
						}
						setIndex((current) => current + 1);
					}}
					className="h-16 flex-1 rounded-full text-lg"
				>
					{isLast ? t("done") : t("next")}
				</Button>
			</div>
		</main>
	);
}
