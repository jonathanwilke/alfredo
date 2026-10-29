import { getPaymentsConfig } from "./config";
import {
	type CheckoutRecord,
	decideCreditGrant,
	parseSucceededPayment,
} from "./grant";
import { applyGrant, applyReversal, type CreditStore } from "./ledger";

const REVERSAL_EVENTS: Record<string, "refund" | "dispute"> = {
	"refund.succeeded": "refund",
	"dispute.lost": "dispute",
	"dispute.accepted": "dispute",
	"dispute.expired": "dispute",
};

export type WebhookDecision =
	| { kind: "payment" }
	| {
			kind: "reversal";
			paymentId: string;
			reversal: "refund" | "dispute";
	  }
	| { kind: "ignore"; eventType: string };

export type WebhookStore = {
	claim(id: string, type: string): Promise<boolean>;
	release(id: string): Promise<void>;
	findUserIdByEmail(email: string): Promise<string | null>;
	findUserIdByCustomer(customerId: string): Promise<string | null>;
	rememberCustomer(userId: string, customerId: string): Promise<void>;
	findCheckoutById(id: string): Promise<CheckoutRecord | null>;
	findCheckoutBySession(sessionId: string): Promise<CheckoutRecord | null>;
	flagCheckout(
		id: string,
		input: {
			status: "granted" | "rejected";
			paymentId: string;
			reason: string | null;
		},
	): Promise<void>;
	credits: CreditStore;
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

export function mapWebhookEvent(event: unknown): WebhookDecision {
	const body = asRecord(event);
	const eventType = stringValue(body?.type) ?? "unknown";
	const data = asRecord(body?.data);
	if (!data) {
		return { kind: "ignore", eventType };
	}

	const reversal = REVERSAL_EVENTS[eventType];
	if (reversal) {
		const paymentId = stringValue(data.payment_id);
		if (!paymentId) {
			return { kind: "ignore", eventType };
		}
		return { kind: "reversal", paymentId, reversal };
	}

	if (eventType === "payment.succeeded") {
		return { kind: "payment" };
	}

	return { kind: "ignore", eventType };
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
		if (decision.kind === "ignore") {
			return "ignored";
		}

		if (decision.kind === "reversal") {
			const outcome = await applyReversal(store.credits, {
				paymentId: decision.paymentId,
				type: decision.reversal,
			});
			return outcome === "ignored" ? "ignored" : "applied";
		}

		const payment = parseSucceededPayment(input.event);
		if (!payment) {
			return "ignored";
		}
		const checkout = payment.checkoutId
			? await store.findCheckoutById(payment.checkoutId)
			: payment.sessionId
				? await store.findCheckoutBySession(payment.sessionId)
				: null;
		const verdict = decideCreditGrant({
			payment,
			checkout,
			productId: getPaymentsConfig().creditsProductId,
		});
		if (!verdict.ok) {
			if (checkout?.status === "pending") {
				await store.flagCheckout(checkout.id, {
					status: "rejected",
					paymentId: payment.paymentId,
					reason: verdict.reason,
				});
			}
			console.error("[billing] payment not granted", verdict.reason);
			return "ignored";
		}
		if (!checkout) {
			return "ignored";
		}

		await applyGrant(store.credits, {
			userId: verdict.userId,
			amount: verdict.credits,
			type: "purchase",
			idempotencyKey: `purchase:${payment.paymentId}`,
			paymentId: payment.paymentId,
			packId: verdict.packId,
			productId: getPaymentsConfig().creditsProductId,
		});
		await store.flagCheckout(checkout.id, {
			status: "granted",
			paymentId: payment.paymentId,
			reason: null,
		});
		if (payment.customerId) {
			await store.rememberCustomer(checkout.userId, payment.customerId);
		}
		return "applied";
	} catch (error) {
		if (claimed) {
			await store.release(input.webhookId);
		}
		throw error;
	}
}
