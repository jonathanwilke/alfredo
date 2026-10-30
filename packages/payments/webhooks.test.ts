import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { Webhook } from "standardwebhooks";
import { CREDIT_PACKS } from "./config";
import {
	mapWebhookEvent,
	processVerifiedWebhook,
	type WebhookStore,
} from "./events";
import type { CheckoutRecord } from "./grant";
import { createMemoryStore } from "./memory-store";
import { verifyWebhook } from "./verify";

const secret = `whsec_${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64")}`;
const productId = "pdt_credits";

const previousProduct = process.env.DODO_PAYMENTS_CREDITS_PRODUCT_ID;

function useCreditsProduct() {
	process.env.DODO_PAYMENTS_CREDITS_PRODUCT_ID = productId;
}

afterEach(() => {
	process.env.DODO_PAYMENTS_CREDITS_PRODUCT_ID = previousProduct;
});

function paymentEvent(
	type: string,
	overrides: Record<string, unknown> = {},
	metadata: Record<string, unknown> = {},
) {
	return {
		business_id: "bus_123",
		type,
		timestamp: "2026-04-15T12:00:00.000Z",
		data: {
			payment_id: "pay_123",
			currency: "USD",
			total_amount: 500,
			tax: 0,
			product_cart: [{ product_id: productId, quantity: 1 }],
			customer: {
				customer_id: "cus_123",
				email: "cook@example.com",
				name: "Cook",
			},
			metadata: {
				checkout_id: "chk_10",
				pack: "pack_10",
				credits: "10",
				user_id: "user_123",
				price_cents: "500",
				...metadata,
			},
			...overrides,
		},
	};
}

function webhookStore() {
	const memory = createMemoryStore();
	const seen = new Set<string>();
	const checkouts = new Map<string, CheckoutRecord>();
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
		async findUserIdByEmail() {
			return null;
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
		async findCheckoutById(id) {
			return checkouts.get(id) ?? null;
		},
		async findCheckoutBySession() {
			return null;
		},
		async flagCheckout(id, input) {
			const current = checkouts.get(id);
			if (!current) {
				return;
			}
			checkouts.set(id, {
				...current,
				status: input.status,
				paymentId: input.paymentId,
			});
		},
	};

	function addCheckout(
		pack: (typeof CREDIT_PACKS)[number],
		id = `chk_${pack.credits}`,
	) {
		checkouts.set(id, {
			id,
			userId: "user_123",
			packId: pack.id,
			credits: pack.credits,
			priceCents: pack.priceCents,
			status: "pending",
			paymentId: null,
		});
		return id;
	}

	return { store, memory, checkouts, addCheckout };
}

describe("payment webhooks", () => {
	it("grants the checkout row once when the same payment is delivered twice", async () => {
		useCreditsProduct();
		const { store, memory, checkouts, addCheckout } = webhookStore();
		addCheckout(CREDIT_PACKS[0]);
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
		assert.equal(checkouts.get("chk_10")?.status, "granted");
		assert.equal(memory.customers.get("user_123"), "cus_123");
	});

	it("grants 20 and 50 credits from the stored checkout, not from a swapped pack id", async () => {
		useCreditsProduct();
		const { store, memory, addCheckout } = webhookStore();
		addCheckout(CREDIT_PACKS[1], "chk_20");
		addCheckout(CREDIT_PACKS[2], "chk_50");
		await processVerifiedWebhook(
			{
				webhookId: "msg_20",
				event: paymentEvent(
					"payment.succeeded",
					{ payment_id: "pay_20", total_amount: 900 },
					{
						checkout_id: "chk_20",
						pack: "pack_20",
						credits: "20",
						price_cents: "900",
					},
				),
			},
			store,
		);
		await processVerifiedWebhook(
			{
				webhookId: "msg_50",
				event: paymentEvent(
					"payment.succeeded",
					{ payment_id: "pay_50", total_amount: 2500, tax: 500 },
					{
						checkout_id: "chk_50",
						pack: "pack_50",
						credits: "50",
						price_cents: "2000",
					},
				),
			},
			store,
		);
		assert.equal(memory.balance("user_123"), 70);
	});

	it("rejects metadata that asks for more credits than the checkout row", async () => {
		useCreditsProduct();
		const { store, memory, checkouts, addCheckout } = webhookStore();
		addCheckout(CREDIT_PACKS[0]);
		assert.equal(
			await processVerifiedWebhook(
				{
					webhookId: "msg_tamper_credits",
					event: paymentEvent(
						"payment.succeeded",
						{},
						{ credits: "50" },
					),
				},
				store,
			),
			"ignored",
		);
		assert.equal(memory.balance("user_123"), 0);
		assert.equal(checkouts.get("chk_10")?.status, "rejected");
		assert.equal(memory.entries.size, 0);
	});

	it("grants a fully discounted pack", async () => {
		useCreditsProduct();
		const { store, memory, checkouts, addCheckout } = webhookStore();
		addCheckout(CREDIT_PACKS[0]);
		assert.equal(
			await processVerifiedWebhook(
				{
					webhookId: "msg_discount",
					event: paymentEvent("payment.succeeded", {
						payment_id: "pay_free",
						total_amount: 0,
						tax: 0,
						discount_id: "dsc_full",
						discounts: [{ discount_id: "dsc_full" }],
					}),
				},
				store,
			),
			"applied",
		);
		assert.equal(memory.balance("user_123"), 10);
		assert.equal(checkouts.get("chk_10")?.status, "granted");
	});

	it("rejects a payment below the price stored at checkout", async () => {
		useCreditsProduct();
		const { store, memory, checkouts, addCheckout } = webhookStore();
		addCheckout(CREDIT_PACKS[0]);
		assert.equal(
			await processVerifiedWebhook(
				{
					webhookId: "msg_cheap",
					event: paymentEvent("payment.succeeded", {
						total_amount: 100,
						tax: 0,
					}),
				},
				store,
			),
			"ignored",
		);
		assert.equal(memory.balance("user_123"), 0);
		assert.equal(checkouts.get("chk_10")?.status, "rejected");
	});

	it("ignores a succeeded payment that does not match a pending checkout", async () => {
		useCreditsProduct();
		const { store, memory } = webhookStore();
		assert.equal(
			mapWebhookEvent(paymentEvent("payment.succeeded")).kind,
			"payment",
		);
		assert.equal(
			await processVerifiedWebhook(
				{
					webhookId: "msg_missing",
					event: paymentEvent(
						"payment.succeeded",
						{},
						{ checkout_id: "missing" },
					),
				},
				store,
			),
			"ignored",
		);
		assert.equal(memory.balance("user_123"), 0);
	});

	it("ignores failed payments and a different product", async () => {
		useCreditsProduct();
		const { store, memory, addCheckout } = webhookStore();
		addCheckout(CREDIT_PACKS[0]);
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
		useCreditsProduct();
		const { store, memory, addCheckout } = webhookStore();
		addCheckout(CREDIT_PACKS[2], "chk_50");
		await processVerifiedWebhook(
			{
				webhookId: "msg_pay",
				event: paymentEvent(
					"payment.succeeded",
					{ payment_id: "pay_50", total_amount: 2000 },
					{
						checkout_id: "chk_50",
						pack: "pack_50",
						credits: "50",
						price_cents: "2000",
					},
				),
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
		useCreditsProduct();
		for (const type of ["dispute.accepted", "dispute.expired"] as const) {
			const { store, memory, addCheckout } = webhookStore();
			const checkoutId = `chk_${type}`;
			addCheckout(CREDIT_PACKS[0], checkoutId);
			await processVerifiedWebhook(
				{
					webhookId: `pay_${type}`,
					event: paymentEvent(
						"payment.succeeded",
						{ payment_id: `pay_${type}` },
						{ checkout_id: checkoutId },
					),
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
