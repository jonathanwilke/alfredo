"use client";

import { api } from "@shared/lib/api";
import { Button } from "@ui/components/button";
import { Timer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

interface TimerOrigin {
	left: number;
	top: number;
	width: number;
	height: number;
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
	const originRef = useRef<TimerOrigin | null>(null);
	const floatRef = useRef<HTMLButtonElement>(null);
	const floatMotionRef = useRef<Animation | null>(null);
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

	useLayoutEffect(() => {
		const origin = originRef.current;
		const el = floatRef.current;
		if (!running || !origin || !el) {
			return;
		}

		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		el.style.transform = "none";
		const to = el.getBoundingClientRect();
		if (reduced || to.height === 0) {
			originRef.current = null;
			return;
		}

		const dx = origin.left + origin.width / 2 - (to.left + to.width / 2);
		const dy = origin.top + origin.height / 2 - (to.top + to.height / 2);
		const scale = origin.height / to.height;
		const from = `translate(${dx}px, ${dy}px) scale(${scale})`;
		el.style.transform = from;
		floatMotionRef.current?.cancel();
		const animation = el.animate(
			[{ transform: from }, { transform: "none" }],
			{
				duration: 480,
				easing: "cubic-bezier(0.22, 1, 0.36, 1)",
				fill: "forwards",
			},
		);
		floatMotionRef.current = animation;
		animation.onfinish = () => {
			el.style.transform = "none";
			animation.cancel();
			originRef.current = null;
		};

		return () => {
			animation.cancel();
		};
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
	const remaining = running ? secondsLeft(running.endsAt, now) : null;

	function wiggleFloatingTimer() {
		const el = floatRef.current;
		if (!el) {
			return;
		}
		floatMotionRef.current?.cancel();
		el.style.transform = "none";
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return;
		}
		floatMotionRef.current = el.animate(
			[
				{ transform: "translateX(0) rotate(0deg)" },
				{ transform: "translateX(-6px) rotate(-7deg)", offset: 0.15 },
				{ transform: "translateX(6px) rotate(7deg)", offset: 0.3 },
				{ transform: "translateX(-5px) rotate(-5deg)", offset: 0.45 },
				{ transform: "translateX(5px) rotate(5deg)", offset: 0.6 },
				{ transform: "translateX(-2px) rotate(-2deg)", offset: 0.75 },
				{ transform: "translateX(2px) rotate(2deg)", offset: 0.9 },
				{ transform: "translateX(0) rotate(0deg)" },
			],
			{ duration: 1000, easing: "linear" },
		);
	}

	function startTimer(event: React.MouseEvent<HTMLButtonElement>) {
		if (step?.timerSeconds == null) {
			return;
		}
		if (running?.stepIndex === index) {
			wiggleFloatingTimer();
			return;
		}
		const box = event.currentTarget.getBoundingClientRect();
		originRef.current = {
			left: box.left,
			top: box.top,
			width: box.width,
			height: box.height,
		};
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
			<header className="sticky top-0 z-20 flex items-center justify-between gap-4 bg-background px-5 py-6 sm:px-8">
				<button
					type="button"
					onClick={onExit}
					className="text-lg text-foreground"
				>
					{t("overview")}
				</button>
				{running && remaining != null ? (
					<div className="pointer-events-none absolute top-1/2 left-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
						<button
							ref={floatRef}
							type="button"
							onClick={() => setIndex(running.stepIndex)}
							aria-label={t("timerReturn")}
							className="pointer-events-auto inline-flex origin-center cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-timer/10 px-4 py-2 font-semibold text-lg text-timer tabular-nums transition-colors hover:bg-timer/20"
						>
							<Timer
								aria-hidden
								strokeWidth={2.25}
								className="size-5"
							/>
							{remaining === 0
								? t("timerDone")
								: formatClock(remaining)}
						</button>
					</div>
				) : null}
				<p className="text-lg tabular-nums">
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
									{piece.text}
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
								{fallbackDuration(step.timerSeconds)}
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
