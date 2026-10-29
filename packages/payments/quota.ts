export const FREE_IMPORT_LIMIT = 1;
export const MONTHLY_IMPORT_LIMIT = 30;
export const PLAN_PRICE_CENTS = 399;
export const PLAN_CURRENCIES = ["USD", "EUR"] as const;
export type PlanCurrency = (typeof PLAN_CURRENCIES)[number];
export type PlanLocale = "de" | "en";

export function planPrice(locale: PlanLocale): {
	priceCents: number;
	currency: PlanCurrency;
} {
	if (locale === "de") {
		return { priceCents: PLAN_PRICE_CENTS, currency: "EUR" };
	}
	return { priceCents: PLAN_PRICE_CENTS, currency: "USD" };
}

export type QuotaPlan = "free" | "monthly";

export type QuotaSubscription = {
	status: string;
	currentPeriodStart: Date | null;
	currentPeriodEnd: Date | null;
	cancelAtPeriodEnd: boolean;
};

export type QuotaRow = {
	createdAt: Date;
	type?: "import" | "translation";
};

export type QuotaSnapshot = {
	plan: QuotaPlan;
	used: number;
	limit: number;
	allowed: boolean;
	periodStart: Date | null;
	periodEnd: Date | null;
	status: string | null;
	cancelAtPeriodEnd: boolean;
};

export function countsTowardQuota(type: "import" | "translation") {
	return type === "import" || type === "translation";
}

export function isMonthlyEntitled(
	subscription: QuotaSubscription | null,
	now: Date,
) {
	if (subscription?.status !== "active") {
		return false;
	}
	if (!subscription.currentPeriodStart || !subscription.currentPeriodEnd) {
		return false;
	}
	return (
		now >= subscription.currentPeriodStart &&
		now < subscription.currentPeriodEnd
	);
}

export function countImportsInWindow(
	rows: QuotaRow[],
	start: Date | null,
	end: Date | null,
) {
	return rows.filter((row) => {
		if (row.type && !countsTowardQuota(row.type)) {
			return false;
		}
		if (start && row.createdAt < start) {
			return false;
		}
		if (end && row.createdAt >= end) {
			return false;
		}
		return true;
	}).length;
}

export function resolveQuota(input: {
	now: Date;
	rows: QuotaRow[];
	subscription: QuotaSubscription | null;
}): QuotaSnapshot {
	const subscription = input.subscription;
	if (subscription && isMonthlyEntitled(subscription, input.now)) {
		const used = countImportsInWindow(
			input.rows,
			subscription.currentPeriodStart,
			subscription.currentPeriodEnd,
		);
		return {
			plan: "monthly",
			used,
			limit: MONTHLY_IMPORT_LIMIT,
			allowed: used < MONTHLY_IMPORT_LIMIT,
			periodStart: subscription.currentPeriodStart,
			periodEnd: subscription.currentPeriodEnd,
			status: subscription.status,
			cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
		};
	}

	const used = countImportsInWindow(input.rows, null, null);
	return {
		plan: "free",
		used,
		limit: FREE_IMPORT_LIMIT,
		allowed: used < FREE_IMPORT_LIMIT,
		periodStart: null,
		periodEnd: null,
		status: subscription?.status ?? null,
		cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
	};
}

export class QuotaExceededError extends Error {
	readonly used: number;
	readonly limit: number;
	readonly plan: QuotaPlan;

	constructor(snapshot: QuotaSnapshot) {
		super("Import quota exceeded");
		this.name = "QuotaExceededError";
		this.used = snapshot.used;
		this.limit = snapshot.limit;
		this.plan = snapshot.plan;
	}
}
