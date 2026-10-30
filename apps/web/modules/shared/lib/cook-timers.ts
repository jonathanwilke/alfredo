"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export type CookTimer = {
	id: string;
	label: string;
	stepIndex: number;
	seconds: number;
	endsAt: number | null;
	remainingMs: number;
	status: "running" | "paused" | "done";
	alertBody: string;
	alerted: boolean;
};

const STORAGE_KEY = "ulivo.cook-timers";

let timers: CookTimer[] = [];
let snapshot: CookTimer[] = [];
let loaded = false;
let lastAlert: { seq: number; label: string } | null = null;
let ticker: number | null = null;
const listeners = new Set<() => void>();

function emit() {
	snapshot = timers.map((timer) => ({ ...timer }));
	persist();
	for (const listener of listeners) {
		listener();
	}
	ensureTicker();
}

function persist() {
	if (typeof window === "undefined") {
		return;
	}
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
	} catch {
		// Storage can be full or blocked. The timers still run in memory.
	}
}

function load() {
	if (loaded || typeof window === "undefined") {
		return;
	}
	loaded = true;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return;
		}
		const parsed = JSON.parse(raw) as CookTimer[];
		if (!Array.isArray(parsed)) {
			return;
		}
		const now = Date.now();
		timers = parsed.flatMap((timer) => {
			if (!timer || typeof timer.id !== "string") {
				return [];
			}
			if (
				timer.status === "running" &&
				timer.endsAt != null &&
				timer.endsAt <= now
			) {
				return [
					{
						...timer,
						status: "done" as const,
						endsAt: null,
						remainingMs: 0,
						alerted: true,
					},
				];
			}
			return [timer];
		});
		snapshot = timers.map((timer) => ({ ...timer }));
	} catch {
		timers = [];
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getTimers() {
	load();
	return snapshot;
}

function getAlert() {
	return lastAlert;
}

function ensureTicker() {
	if (typeof window === "undefined") {
		return;
	}
	if (ticker != null || !timers.some((timer) => timer.status === "running")) {
		return;
	}
	ticker = window.setInterval(() => {
		const now = Date.now();
		const due = timers.filter(
			(timer) =>
				timer.status === "running" &&
				timer.endsAt != null &&
				timer.endsAt <= now,
		);
		if (due.length === 0) {
			if (
				ticker != null &&
				!timers.some((timer) => timer.status === "running")
			) {
				window.clearInterval(ticker);
				ticker = null;
			}
			return;
		}
		for (const timer of due) {
			finishTimer(timer.id);
		}
	}, 250);
}

function playChime() {
	const AudioCtx = window.AudioContext;
	if (!AudioCtx) {
		return;
	}
	const context = new AudioCtx();
	const oscillator = context.createOscillator();
	const gain = context.createGain();
	oscillator.frequency.value = 880;
	oscillator.type = "sine";
	gain.gain.setValueAtTime(0.0001, context.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
	oscillator.connect(gain);
	gain.connect(context.destination);
	oscillator.start();
	oscillator.stop(context.currentTime + 0.5);
	oscillator.onended = () => {
		void context.close();
	};
}

function finishTimer(id: string) {
	const current = timers.find((timer) => timer.id === id);
	if (!current || current.status === "done") {
		return;
	}
	const shouldAlert = !current.alerted;
	timers = timers.map((timer) =>
		timer.id === id
			? {
					...timer,
					status: "done",
					endsAt: null,
					remainingMs: 0,
					alerted: true,
				}
			: timer,
	);
	if (shouldAlert) {
		lastAlert = { seq: Date.now(), label: current.label };
		playChime();
		navigator.vibrate?.([180, 80, 180]);
		if (
			typeof Notification !== "undefined" &&
			Notification.permission === "granted"
		) {
			try {
				new Notification("ulivo", { body: current.alertBody });
			} catch {
				// Some browsers block the constructor without a user gesture.
			}
		}
	}
	emit();
}

function replace(id: string, next: CookTimer) {
	timers = timers.map((timer) => (timer.id === id ? next : timer));
	emit();
}

export function startCookTimer(input: {
	id: string;
	label: string;
	stepIndex: number;
	seconds: number;
	alertBody: string;
}) {
	load();
	if (
		typeof Notification !== "undefined" &&
		Notification.permission === "default"
	) {
		void Notification.requestPermission();
	}
	const existing = timers.find((timer) => timer.id === input.id);
	if (existing?.status === "running") {
		return;
	}
	if (existing?.status === "paused") {
		resumeCookTimer(input.id);
		return;
	}
	const endsAt = Date.now() + input.seconds * 1000;
	const next: CookTimer = {
		id: input.id,
		label: input.label,
		stepIndex: input.stepIndex,
		seconds: input.seconds,
		endsAt,
		remainingMs: input.seconds * 1000,
		status: "running",
		alertBody: input.alertBody,
		alerted: false,
	};
	timers = existing
		? timers.map((timer) => (timer.id === input.id ? next : timer))
		: [...timers, next];
	emit();
}

export function pauseCookTimer(id: string) {
	load();
	const current = timers.find((timer) => timer.id === id);
	if (current?.status !== "running" || current.endsAt == null) {
		return;
	}
	replace(id, {
		...current,
		status: "paused",
		endsAt: null,
		remainingMs: Math.max(0, current.endsAt - Date.now()),
	});
}

export function resumeCookTimer(id: string) {
	load();
	const current = timers.find((timer) => timer.id === id);
	if (current?.status !== "paused") {
		return;
	}
	replace(id, {
		...current,
		status: "running",
		endsAt: Date.now() + current.remainingMs,
		alerted: false,
	});
}

export function addCookMinute(id: string) {
	load();
	const current = timers.find((timer) => timer.id === id);
	if (!current) {
		return;
	}
	if (current.status === "paused") {
		replace(id, { ...current, remainingMs: current.remainingMs + 60_000 });
		return;
	}
	if (current.status === "done") {
		startCookTimer({
			id: current.id,
			label: current.label,
			stepIndex: current.stepIndex,
			seconds: 60,
			alertBody: current.alertBody,
		});
		return;
	}
	if (current.endsAt == null) {
		return;
	}
	replace(id, {
		...current,
		endsAt: current.endsAt + 60_000,
		seconds: current.seconds + 60,
	});
}

export function cancelCookTimer(id: string) {
	load();
	timers = timers.filter((timer) => timer.id !== id);
	emit();
}

export function remainingSeconds(timer: CookTimer, now: number) {
	if (timer.status === "done") {
		return 0;
	}
	if (timer.status === "paused" || timer.endsAt == null) {
		return Math.max(0, Math.ceil(timer.remainingMs / 1000));
	}
	return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}

export function useCookTimers() {
	return useSyncExternalStore(subscribe, getTimers, () => snapshot);
}

export function useTimerAlert() {
	return useSyncExternalStore(subscribe, getAlert, () => null);
}

export function useTimerClock() {
	const current = useCookTimers();
	const running = current.some((timer) => timer.status === "running");
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		load();
		ensureTicker();
	}, [running]);

	useEffect(() => {
		if (!running) {
			return;
		}
		const id = window.setInterval(() => setNow(Date.now()), 250);
		return () => window.clearInterval(id);
	}, [running]);

	useEffect(() => {
		function onVisible() {
			setNow(Date.now());
			const due = timers.filter(
				(timer) =>
					timer.status === "running" &&
					timer.endsAt != null &&
					timer.endsAt <= Date.now(),
			);
			for (const timer of due) {
				finishTimer(timer.id);
			}
		}
		document.addEventListener("visibilitychange", onVisible);
		return () =>
			document.removeEventListener("visibilitychange", onVisible);
	}, []);

	return { timers: current, now };
}
