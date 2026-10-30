import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";

export type CookTimer = {
	id: string;
	label: string;
	stepIndex: number;
	seconds: number;
	endsAt: number | null;
	remainingMs: number;
	status: "running" | "paused" | "done";
	notificationId: string | null;
	alertBody: string;
};

export type TimerAlert = {
	seq: number;
	label: string;
};

const CHANNEL = "timers";

let timers: CookTimer[] = [];
let snapshot: CookTimer[] = [];
let lastAlert: TimerAlert | null = null;
let permissionAsked = false;
let ticker: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
});

function emit() {
	snapshot = timers.map((timer) => ({ ...timer }));
	for (const listener of listeners) {
		listener();
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getTimers() {
	return snapshot;
}

function getAlert() {
	return lastAlert;
}

function ensureTicker() {
	if (ticker || !timers.some((timer) => timer.status === "running")) {
		return;
	}
	ticker = setInterval(() => {
		const now = Date.now();
		const due = timers.filter(
			(timer) =>
				timer.status === "running" &&
				timer.endsAt != null &&
				timer.endsAt <= now,
		);
		if (due.length === 0) {
			if (!timers.some((timer) => timer.status === "running") && ticker) {
				clearInterval(ticker);
				ticker = null;
			}
			return;
		}
		const alert = AppState.currentState === "active";
		for (const timer of due) {
			void finishTimer(timer.id, alert);
		}
	}, 250);
}

async function ensureChannel() {
	if (Platform.OS !== "android") {
		return;
	}
	await Notifications.setNotificationChannelAsync(CHANNEL, {
		name: "Timers",
		importance: Notifications.AndroidImportance.HIGH,
		sound: "default",
		vibrationPattern: [0, 250, 250, 250],
	});
}

async function ensurePermission() {
	try {
		const current = await Notifications.getPermissionsAsync();
		if (current.granted) {
			return true;
		}
		if (permissionAsked) {
			return false;
		}
		permissionAsked = true;
		const next = await Notifications.requestPermissionsAsync();
		return next.granted;
	} catch {
		return false;
	}
}

async function schedule(endsAt: number, body: string) {
	const granted = await ensurePermission();
	if (!granted || endsAt <= Date.now()) {
		return null;
	}
	try {
		await ensureChannel();
		return await Notifications.scheduleNotificationAsync({
			content: {
				title: "ulivo",
				body,
				sound: "default",
			},
			trigger: {
				type: Notifications.SchedulableTriggerInputTypes.DATE,
				date: new Date(endsAt),
				channelId: Platform.OS === "android" ? CHANNEL : undefined,
			},
		});
	} catch {
		return null;
	}
}

async function cancelNotification(id: string | null) {
	if (!id) {
		return;
	}
	try {
		await Notifications.cancelScheduledNotificationAsync(id);
	} catch {
		// The notification may already have been delivered.
	}
}

async function playAlert(body: string) {
	try {
		await Haptics.notificationAsync(
			Haptics.NotificationFeedbackType.Warning,
		);
	} catch {
		// Haptics are unavailable on some devices.
	}
	try {
		await Notifications.scheduleNotificationAsync({
			content: {
				title: "ulivo",
				body,
				sound: "default",
			},
			trigger: null,
		});
	} catch {
		// A denied permission still leaves the in-app alert.
	}
}

function replace(id: string, next: CookTimer) {
	timers = timers.map((timer) => (timer.id === id ? next : timer));
	emit();
	ensureTicker();
}

async function finishTimer(id: string, alert: boolean) {
	const current = timers.find((timer) => timer.id === id);
	if (!current || current.status === "done") {
		return;
	}
	const notificationId = current.notificationId;
	replace(id, {
		...current,
		status: "done",
		endsAt: null,
		remainingMs: 0,
		notificationId: null,
	});
	if (alert) {
		await cancelNotification(notificationId);
		lastAlert = { seq: Date.now(), label: current.label };
		emit();
		await playAlert(current.alertBody);
		return;
	}
	// Background delivery already owns the scheduled notification.
}

export async function startCookTimer(input: {
	id: string;
	label: string;
	stepIndex: number;
	seconds: number;
	alertBody: string;
}) {
	const existing = timers.find((timer) => timer.id === input.id);
	if (existing?.status === "running") {
		return;
	}
	if (existing?.status === "paused") {
		await resumeCookTimer(input.id);
		return;
	}
	const endsAt = Date.now() + input.seconds * 1000;
	const notificationId = await schedule(endsAt, input.alertBody);
	const next: CookTimer = {
		id: input.id,
		label: input.label,
		stepIndex: input.stepIndex,
		seconds: input.seconds,
		endsAt,
		remainingMs: input.seconds * 1000,
		status: "running",
		notificationId,
		alertBody: input.alertBody,
	};
	timers = existing
		? timers.map((timer) => (timer.id === input.id ? next : timer))
		: [...timers, next];
	emit();
	ensureTicker();
}

export async function pauseCookTimer(id: string) {
	const current = timers.find((timer) => timer.id === id);
	if (current?.status !== "running" || current.endsAt == null) {
		return;
	}
	const remainingMs = Math.max(0, current.endsAt - Date.now());
	await cancelNotification(current.notificationId);
	replace(id, {
		...current,
		status: "paused",
		endsAt: null,
		remainingMs,
		notificationId: null,
	});
}

export async function resumeCookTimer(id: string) {
	const current = timers.find((timer) => timer.id === id);
	if (current?.status !== "paused") {
		return;
	}
	const endsAt = Date.now() + current.remainingMs;
	const notificationId = await schedule(endsAt, current.alertBody);
	replace(id, {
		...current,
		status: "running",
		endsAt,
		notificationId,
	});
}

export async function addCookMinute(id: string) {
	const current = timers.find((timer) => timer.id === id);
	if (!current) {
		return;
	}
	if (current.status === "paused") {
		replace(id, {
			...current,
			remainingMs: current.remainingMs + 60_000,
		});
		return;
	}
	if (current.status === "done") {
		await startCookTimer({
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
	const endsAt = current.endsAt + 60_000;
	await cancelNotification(current.notificationId);
	const notificationId = await schedule(endsAt, current.alertBody);
	replace(id, {
		...current,
		endsAt,
		notificationId,
		seconds: current.seconds + 60,
	});
}

export async function cancelCookTimer(id: string) {
	const current = timers.find((timer) => timer.id === id);
	if (!current) {
		return;
	}
	await cancelNotification(current.notificationId);
	timers = timers.filter((timer) => timer.id !== id);
	emit();
	if (!timers.some((timer) => timer.status === "running") && ticker) {
		clearInterval(ticker);
		ticker = null;
	}
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
	return useSyncExternalStore(subscribe, getTimers, getTimers);
}

export function useTimerAlert() {
	return useSyncExternalStore(subscribe, getAlert, getAlert);
}

export function useTimerClock() {
	const timersNow = useCookTimers();
	const running = timersNow.some((timer) => timer.status === "running");
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (!running) {
			return;
		}
		const id = setInterval(() => setNow(Date.now()), 250);
		return () => clearInterval(id);
	}, [running]);

	useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) => {
			if (state !== "active") {
				return;
			}
			setNow(Date.now());
			const due = timers.filter(
				(timer) =>
					timer.status === "running" &&
					timer.endsAt != null &&
					timer.endsAt <= Date.now(),
			);
			for (const timer of due) {
				void finishTimer(timer.id, false);
			}
		});
		return () => subscription.remove();
	}, []);

	return { timers: timersNow, now };
}

AppState.addEventListener("change", (state) => {
	if (state !== "active") {
		return;
	}
	const due = timers.filter(
		(timer) =>
			timer.status === "running" &&
			timer.endsAt != null &&
			timer.endsAt <= Date.now(),
	);
	for (const timer of due) {
		void finishTimer(timer.id, false);
	}
});
