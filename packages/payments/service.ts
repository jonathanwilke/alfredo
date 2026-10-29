import { db, imports, subscriptions } from "@repo/database";
import { and, count, desc, eq, gte, lt } from "drizzle-orm";
import {
	isMonthlyEntitled,
	MONTHLY_IMPORT_LIMIT,
	type PlanCurrency,
	type PlanLocale,
	planPrice,
	QuotaExceededError,
	type QuotaSnapshot,
	type QuotaSubscription,
	resolveQuota,
} from "./quota";

export { QuotaExceededError };

export type BillingStatus = QuotaSnapshot & {
	billingEnabled: boolean;
	authenticated: boolean;
	hasCustomer: boolean;
	monthlyLimit: number;
	priceCents: number;
	currency: PlanCurrency;
	interval: "month";
};

function emptyStatus(
	billingEnabled: boolean,
	authenticated: boolean,
	locale: PlanLocale,
): BillingStatus {
	const quota = resolveQuota({
		now: new Date(),
		rows: [],
		subscription: null,
	});
	const price = planPrice(locale);
	return {
		...quota,
		allowed: authenticated ? quota.allowed : false,
		billingEnabled,
		authenticated,
		hasCustomer: false,
		monthlyLimit: MONTHLY_IMPORT_LIMIT,
		priceCents: price.priceCents,
		currency: price.currency,
		interval: "month",
	};
}

function toSubscription(
	row: typeof subscriptions.$inferSelect,
): QuotaSubscription {
	return {
		status: row.status,
		currentPeriodStart: row.currentPeriodStart,
		currentPeriodEnd: row.currentPeriodEnd,
		cancelAtPeriodEnd: row.cancelAtPeriodEnd,
	};
}

export async function getQuotaForUser(userId: string, now = new Date()) {
	const rows = await db
		.select()
		.from(subscriptions)
		.where(eq(subscriptions.userId, userId))
		.orderBy(desc(subscriptions.updatedAt));

	const mapped = rows.map(toSubscription);
	const entitled = mapped.find((row) => isMonthlyEntitled(row, now)) ?? null;
	const subscription = entitled ?? mapped[0] ?? null;

	const filters = [eq(imports.userId, userId)];
	if (entitled?.currentPeriodStart && entitled.currentPeriodEnd) {
		filters.push(gte(imports.createdAt, entitled.currentPeriodStart));
		filters.push(lt(imports.createdAt, entitled.currentPeriodEnd));
	}

	const [counted] = await db
		.select({ value: count() })
		.from(imports)
		.where(and(...filters));
	const used = Number(counted?.value ?? 0);

	return resolveQuota({
		now,
		rows: Array.from({ length: used }, () => ({ createdAt: now })),
		subscription,
	});
}

export async function getBillingStatus(input: {
	userId: string | null;
	billingEnabled: boolean;
	locale: PlanLocale;
	now?: Date;
}): Promise<BillingStatus> {
	const price = planPrice(input.locale);
	if (!input.userId) {
		return emptyStatus(input.billingEnabled, false, input.locale);
	}

	const now = input.now ?? new Date();
	const quota = await getQuotaForUser(input.userId, now);
	const [customer] = await db
		.select({ customerId: subscriptions.customerId })
		.from(subscriptions)
		.where(eq(subscriptions.userId, input.userId))
		.orderBy(desc(subscriptions.updatedAt))
		.limit(1);

	return {
		...quota,
		billingEnabled: input.billingEnabled,
		authenticated: true,
		hasCustomer: Boolean(customer?.customerId),
		monthlyLimit: MONTHLY_IMPORT_LIMIT,
		priceCents: price.priceCents,
		currency: price.currency,
		interval: "month",
	};
}

export async function assertImportAllowed(userId: string) {
	const snapshot = await getQuotaForUser(userId);
	if (!snapshot.allowed) {
		throw new QuotaExceededError(snapshot);
	}
	return snapshot;
}
