import { packForProductId } from "./config";
import {
	applyGrant,
	applyReversal,
	type CreditStore,
	type LedgerType,
} from "./ledger";

const REVERSAL_EVENTS: Record<string, "refund" | "dispute"> = {
	"refund.succeeded": "refund",
	"dispute.lost": "dispute",
	"dispute.accepted": "dispute",
	"dispute.expired": "dispute",
};

export type ProductLine = {
	productId: string;
	quantity: number;
};

export type WebhookDecision =
	| {
			kind: "grant";
			paymentId: string;
			lines: ProductLine[];
			userId: string | null;
			email: string | null;
			customerId: string | null;
	  }
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

function quantityValue(value: unknown) {
	if (
		typeof value === "number" &&
		Number.isInteger(value) &&
		value > 0 &&
		value <= 20
	) {
		return value;
	}
	return 1;
}

function productLines(data: Record<string, unknown>) {
	if (!Array.isArray(data.product_cart)) {
		return [];
	}
	const lines: ProductLine[] = [];
	for (const item of data.product_cart) {
		const row = asRecord(item);
		const productId = stringValue(row?.product_id);
		if (!productId) {
			continue;
		}
		lines.push({ productId, quantity: quantityValue(row?.quantity) });
	}
	return lines;
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

	if (eventType !== "payment.succeeded") {
		return { kind: "ignore", eventType };
	}

	const paymentId = stringValue(data.payment_id);
	const lines = productLines(data);
	if (!paymentId || lines.length === 0) {
		return { kind: "ignore", eventType };
	}

	const customer = asRecord(data.customer);
	const metadata = asRecord(data.metadata);
	return {
		kind: "grant",
		paymentId,
		lines,
		userId: stringValue(metadata?.user_id) ?? stringValue(metadata?.userId),
		email: stringValue(customer?.email),
		customerId:
			stringValue(customer?.customer_id) ?? stringValue(data.customer_id),
	};
}

async function resolveUserId(
	decision: Extract<WebhookDecision, { kind: "grant" }>,
	store: WebhookStore,
) {
	if (decision.userId) {
		return decision.userId;
	}
	if (decision.email) {
		const byEmail = await store.findUserIdByEmail(decision.email);
		if (byEmail) {
			return byEmail;
		}
	}
	if (decision.customerId) {
		return store.findUserIdByCustomer(decision.customerId);
	}
	return null;
}

function grantForLines(lines: ProductLine[]) {
	let credits = 0;
	let packId: string | null = null;
	let productId: string | null = null;
	for (const line of lines) {
		const pack = packForProductId(line.productId);
		if (!pack) {
			continue;
		}
		credits += pack.credits * line.quantity;
		packId = packId ?? pack.id;
		productId = productId ?? line.productId;
	}
	return { credits, packId, productId };
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

		const userId = await resolveUserId(decision, store);
		if (!userId) {
			throw new Error("unresolved-payment-user");
		}

		const grant = grantForLines(decision.lines);
		if (grant.credits <= 0 || !grant.productId) {
			return "ignored";
		}

		await applyGrant(store.credits, {
			userId,
			amount: grant.credits,
			type: "purchase" satisfies LedgerType,
			idempotencyKey: `purchase:${decision.paymentId}`,
			paymentId: decision.paymentId,
			packId: grant.packId,
			productId: grant.productId,
		});

		if (decision.customerId) {
			await store.rememberCustomer(userId, decision.customerId);
		}
		return "applied";
	} catch (error) {
		if (claimed) {
			await store.release(input.webhookId);
		}
		throw error;
	}
}
