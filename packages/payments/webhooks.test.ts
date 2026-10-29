import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { Webhook } from "standardwebhooks";
import {
	mapWebhookEvent,
	processVerifiedWebhook,
	type WebhookStore,
} from "./events";
import { createMemoryStore } from "./memory-store";
import { verifyWebhook } from "./verify";

const secret = `whsec_${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64")}`;

const previousEnv = {
	pack10: process.env.DODO_PAYMENTS_PRODUCT_ID_PACK_10,
	pack20: process.env.DODO_PAYMENTS_PRODUCT_ID_PACK_20,
	pack50: process.env.DODO_PAYMENTS_PRODUCT_ID_PACK_50,
};

function usePackProducts() {
	process.env.DODO_PAYMENTS_PRODUCT_ID_PACK_10 = "pdt_10";
	process.env.DODO_PAYMENTS_PRODUCT_ID_PACK_20 = "pdt_20";
	process.env.DODO_PAYMENTS_PRODUCT_ID_PACK_50 = "pdt_50";
}

afterEach(() => {
	process.env.DODO_PAYMENTS_PRODUCT_ID_PACK_10 = previousEnv.pack10;
	process.env.DODO_PAYMENTS_PRODUCT_ID_PACK_20 = previousEnv.pack20;
	process.env.DODO_PAYMENTS_PRODUCT_ID_PACK_50 = previousEnv.pack50;
});

function paymentEvent(type: string, overrides: Record<string, unknown> = {}) {
	return {
		business_id: "bus_123",
		type,
		timestamp: "2026-04-15T12:00:00.000Z",
		data: {
			payment_id: "pay_123",
			product_cart: [{ product_id: "pdt_10", quantity: 1 }],
			customer: {
				customer_id: "cus_123",
				email: "cook@example.com",
				name: "Cook",
			},
			metadata: { user_id: "user_123", pack: "pack_10" },
			...overrides,
		},
	};
}

function webhookStore() {
	const memory = createMemoryStore();
	const seen = new Set<string>();
	const users = new Map<string, string>([
		["cook@example.com", "user_from_email"],
	]);
	const store: WebhookStore = {
		credits: memory.store,
		async claim(id) {
			if (seen.has(id)) {
				return false;
			}
			seen.add(id);
			return true;
		},
		async release(id) {
			seen.delete(id);
		},
		async findUserIdByEmail(email) {
			return users.get(email.toLowerCase()) ?? null;
		},
		async findUserIdByCustomer(customerId) {
			for (const [userId, stored] of memory.customers) {
				if (stored === customerId) {
					return userId;
				}
			}
			return null;
		},
		async rememberCustomer(userId, customerId) {
			memory.customers.set(userId, customerId);
		},
	};
	return { store, memory, seen };
}

describe("payment webhooks", () => {
	it("grants pack credits once when the same payment is delivered twice", async () => {
		usePackProducts();
		const { store, memory } = webhookStore();
		const event = paymentEvent("payment.succeeded");

		assert.equal(
			await processVerifiedWebhook({ webhookId: "msg_1", event }, store),
			"applied",
		);
		assert.equal(
			await processVerifiedWebhook({ webhookId: "msg_1", event }, store),
			"duplicate",
		);
		assert.equal(
			await processVerifiedWebhook({ webhookId: "msg_2", event }, store),
			"applied",
		);
		assert.equal(memory.balance("user_123"), 10);
		assert.equal(memory.customers.get("user_123"), "cus_123");
	});

	it("grants 20 and 50 credit packs from their product ids", async () => {
		usePackProducts();
		const { store, memory } = webhookStore();
		await processVerifiedWebhook(
			{
				webhookId: "msg_20",
				event: paymentEvent("payment.succeeded", {
					payment_id: "pay_20",
					product_cart: [{ product_id: "pdt_20", quantity: 1 }],
					metadata: { user_id: "user_123", pack: "pack_20" },
				}),
			},
			store,
		);
		await processVerifiedWebhook(
			{
				webhookId: "msg_50",
				event: paymentEvent("payment.succeeded", {
					payment_id: "pay_50",
					product_cart: [{ product_id: "pdt_50", quantity: 1 }],
				}),
			},
			store,
		);
		assert.equal(memory.balance("user_123"), 70);
	});

	it("links a payment by email when metadata has no user id", async () => {
		usePackProducts();
		const { store, memory } = webhookStore();
		await processVerifiedWebhook(
			{
				webhookId: "msg_email",
				event: paymentEvent("payment.succeeded", { metadata: {} }),
			},
			store,
		);
		assert.equal(memory.balance("user_from_email"), 10);
	});

	it("ignores failed payments and unknown products", async () => {
		usePackProducts();
		const { store, memory } = webhookStore();
		for (const type of [
			"payment.failed",
			"payment.processing",
			"payment.cancelled",
			"refund.failed",
			"dispute.opened",
			"dispute.won",
			"subscription.active",
		]) {
			assert.equal(mapWebhookEvent(paymentEvent(type)).kind, "ignore");
			assert.equal(
				await processVerifiedWebhook(
					{ webhookId: `msg_${type}`, event: paymentEvent(type) },
					store,
				),
				"ignored",
			);
		}
		assert.equal(
			await processVerifiedWebhook(
				{
					webhookId: "msg_unknown",
					event: paymentEvent("payment.succeeded", {
						payment_id: "pay_unknown",
						product_cart: [
							{ product_id: "pdt_other", quantity: 1 },
						],
					}),
				},
				store,
			),
			"ignored",
		);
		assert.equal(memory.balance("user_123"), 0);
	});

	it("debits the granted pack on refund and does not debit again on a lost dispute", async () => {
		usePackProducts();
		const { store, memory } = webhookStore();
		await processVerifiedWebhook(
			{
				webhookId: "msg_pay",
				event: paymentEvent("payment.succeeded", {
					payment_id: "pay_50",
					product_cart: [{ product_id: "pdt_50", quantity: 1 }],
				}),
			},
			store,
		);
		assert.equal(
			await processVerifiedWebhook(
				{
					webhookId: "msg_refund",
					event: {
						type: "refund.succeeded",
						timestamp: "2026-04-16T00:00:00.000Z",
						data: {
							refund_id: "ref_1",
							payment_id: "pay_50",
							status: "succeeded",
							amount: 2000,
							is_partial: false,
						},
					},
				},
				store,
			),
			"applied",
		);
		assert.equal(memory.balance("user_123"), 0);
		assert.equal(
			await processVerifiedWebhook(
				{
					webhookId: "msg_dispute",
					event: {
						type: "dispute.lost",
						timestamp: "2026-04-17T00:00:00.000Z",
						data: {
							dispute_id: "dis_1",
							payment_id: "pay_50",
							amount: "20.00",
						},
					},
				},
				store,
			),
			"applied",
		);
		assert.equal(memory.balance("user_123"), 0);
		const reversal = [...memory.entries.values()].find(
			(entry) => entry.idempotencyKey === "reversal:pay_50",
		);
		assert.equal(reversal?.type, "refund");
		assert.equal(reversal?.amount, -50);
	});

	it("debits when a dispute is accepted or expires", async () => {
		usePackProducts();
		for (const type of ["dispute.accepted", "dispute.expired"] as const) {
			const { store, memory } = webhookStore();
			await processVerifiedWebhook(
				{
					webhookId: `pay_${type}`,
					event: paymentEvent("payment.succeeded", {
						payment_id: `pay_${type}`,
					}),
				},
				store,
			);
			await processVerifiedWebhook(
				{
					webhookId: `msg_${type}`,
					event: {
						type,
						data: {
							dispute_id: `dis_${type}`,
							payment_id: `pay_${type}`,
						},
					},
				},
				store,
			);
			assert.equal(memory.balance("user_123"), 0);
		}
	});

	it("verifies a standard-webhooks signature and rejects a bad one", () => {
		const payload = JSON.stringify(paymentEvent("payment.succeeded"));
		const webhookId = "msg_signed";
		const timestamp = new Date();
		const webhook = new Webhook(secret);
		const signature = webhook.sign(webhookId, timestamp, payload);
		const headers = {
			"webhook-id": webhookId,
			"webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
			"webhook-signature": signature,
		};
		const verified = verifyWebhook(payload, headers, secret);
		assert.equal((verified as { type: string }).type, "payment.succeeded");
		assert.throws(() =>
			verifyWebhook(
				payload,
				{ ...headers, "webhook-signature": "v1,bad" },
				secret,
			),
		);
	});
});
