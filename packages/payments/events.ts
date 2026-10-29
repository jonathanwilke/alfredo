export type SubscriptionPatch = {
	userId: string | null;
	customerEmail: string | null;
	customerId: string;
	subscriptionId: string;
	productId: string;
	status: string;
	currentPeriodStart: Date | null;
	currentPeriodEnd: Date | null;
	cancelAtPeriodEnd: boolean;
	eventAt: Date;
};

export type WebhookDecision =
	| { kind: "subscription"; patch: SubscriptionPatch }
	| { kind: "payment"; eventType: string }
	| { kind: "ignore"; eventType: string };

const SUBSCRIPTION_EVENTS = new Set([
	"subscription.active",
	"subscription.renewed",
	"subscription.on_hold",
	"subscription.cancelled",
	"subscription.failed",
	"subscription.expired",
	"subscription.updated",
	"subscription.past_due",
	"subscription.paused",
	"subscription.unpaused",
	"subscription.plan_changed",
]);

const STATUS_FROM_EVENT: Record<string, string> = {
	"subscription.active": "active",
	"subscription.renewed": "active",
	"subscription.on_hold": "on_hold",
	"subscription.cancelled": "cancelled",
	"subscription.failed": "failed",
	"subscription.expired": "expired",
	"subscription.past_due": "past_due",
	"subscription.paused": "paused",
	"subscription.unpaused": "active",
};

export type WebhookStore = {
	claim(id: string, type: string): Promise<boolean>;
	release(id: string): Promise<void>;
	findUserIdByEmail(email: string): Promise<string | null>;
	findUserIdBySubscription(subscriptionId: string): Promise<string | null>;
	findUserIdByCustomer(customerId: string): Promise<string | null>;
	getLastEventAt(subscriptionId: string): Promise<Date | null>;
	upsert(patch: SubscriptionPatch & { userId: string }): Promise<void>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
	if (typeof value === "string" && value.trim().length > 0) {
		return value.trim();
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	return null;
}

function parseDate(value: unknown) {
	if (typeof value !== "string" && typeof value !== "number") {
		return null;
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function booleanValue(value: unknown) {
	return value === true;
}

export function shouldApplySubscriptionUpdate(
	existingEventAt: Date | null,
	incoming: Date,
) {
	if (!existingEventAt) {
		return true;
	}
	return incoming.getTime() >= existingEventAt.getTime();
}

export function mapWebhookEvent(event: unknown): WebhookDecision {
	const body = asRecord(event);
	const eventType = stringValue(body?.type) ?? "unknown";
	if (eventType.startsWith("payment.")) {
		return { kind: "payment", eventType };
	}
	if (!SUBSCRIPTION_EVENTS.has(eventType)) {
		return { kind: "ignore", eventType };
	}

	const data = asRecord(body?.data);
	const customer = asRecord(data?.customer);
	const metadata = asRecord(data?.metadata);
	const subscriptionId = stringValue(data?.subscription_id);
	const customerId =
		stringValue(customer?.customer_id) ?? stringValue(data?.customer_id);
	if (!data || !subscriptionId || !customerId) {
		return { kind: "ignore", eventType };
	}

	const eventAt = parseDate(body?.timestamp) ?? new Date();
	return {
		kind: "subscription",
		patch: {
			userId:
				stringValue(metadata?.user_id) ?? stringValue(metadata?.userId),
			customerEmail: stringValue(customer?.email),
			customerId,
			subscriptionId,
			productId: stringValue(data.product_id) ?? "",
			status:
				stringValue(data.status) ??
				STATUS_FROM_EVENT[eventType] ??
				"pending",
			currentPeriodStart: parseDate(data.previous_billing_date),
			currentPeriodEnd: parseDate(data.next_billing_date),
			cancelAtPeriodEnd: booleanValue(data.cancel_at_next_billing_date),
			eventAt,
		},
	};
}

async function resolveUserId(patch: SubscriptionPatch, store: WebhookStore) {
	if (patch.userId) {
		return patch.userId;
	}
	if (patch.customerEmail) {
		const byEmail = await store.findUserIdByEmail(patch.customerEmail);
		if (byEmail) {
			return byEmail;
		}
	}
	const bySubscription = await store.findUserIdBySubscription(
		patch.subscriptionId,
	);
	if (bySubscription) {
		return bySubscription;
	}
	return store.findUserIdByCustomer(patch.customerId);
}

export async function processVerifiedWebhook(
	input: { webhookId: string; event: unknown },
	store: WebhookStore,
): Promise<"duplicate" | "applied" | "ignored"> {
	const eventType = stringValue(asRecord(input.event)?.type) ?? "unknown";
	let claimed = false;
	try {
		claimed = await store.claim(input.webhookId, eventType);
		if (!claimed) {
			return "duplicate";
		}
		const decision = mapWebhookEvent(input.event);
		if (decision.kind === "payment") {
			return "applied";
		}
		if (decision.kind === "ignore") {
			return "ignored";
		}
		const userId = await resolveUserId(decision.patch, store);
		if (!userId) {
			return "ignored";
		}
		const existing = await store.getLastEventAt(
			decision.patch.subscriptionId,
		);
		if (!shouldApplySubscriptionUpdate(existing, decision.patch.eventAt)) {
			return "ignored";
		}
		await store.upsert({ ...decision.patch, userId });
		return "applied";
	} catch (error) {
		if (claimed) {
			await store.release(input.webhookId);
		}
		throw error;
	}
}
