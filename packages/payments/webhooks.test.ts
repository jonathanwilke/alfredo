import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Webhook } from "standardwebhooks";
import {
	mapWebhookEvent,
	processVerifiedWebhook,
	type SubscriptionPatch,
	shouldApplySubscriptionUpdate,
	type WebhookStore,
} from "./events";
import { verifyWebhook } from "./verify";

const secret = `whsec_${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64")}`;

function subscriptionEvent(
	type: string,
	overrides: Record<string, unknown> = {},
) {
	return {
		business_id: "bus_123",
		type,
		timestamp: "2026-04-15T12:00:00.000Z",
		data: {
			subscription_id: "sub_123",
			product_id: "pdt_123",
			status: "active",
			previous_billing_date: "2026-04-01T00:00:00.000Z",
			next_billing_date: "2026-05-01T00:00:00.000Z",
			cancel_at_next_billing_date: false,
			customer: {
				customer_id: "cus_123",
				email: "cook@example.com",
			},
			metadata: { user_id: "user_123" },
			...overrides,
		},
	};
}

function memoryStore() {
	const seen = new Set<string>();
	const upserts: Array<SubscriptionPatch & { userId: string }> = [];
	let lastEventAt: Date | null = null;
	const store: WebhookStore = {
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
			return email === "cook@example.com" ? "user_from_email" : null;
		},
		async findUserIdBySubscription() {
			return null;
		},
		async findUserIdByCustomer() {
			return null;
		},
		async getLastEventAt() {
			return lastEventAt;
		},
		async upsert(patch) {
			lastEventAt = patch.eventAt;
			upserts.push(patch);
		},
	};
	return { store, upserts, seen };
}

describe("webhook events", () => {
	it("maps subscription lifecycle events onto the local row", () => {
		const cases = [
			["subscription.active", "active"],
			["subscription.renewed", "active"],
			["subscription.on_hold", "on_hold"],
			["subscription.cancelled", "cancelled"],
			["subscription.failed", "failed"],
			["subscription.expired", "expired"],
		] as const;

		for (const [type, status] of cases) {
			const decision = mapWebhookEvent(
				subscriptionEvent(type, {
					status,
					cancel_at_next_billing_date: type === "subscription.active",
				}),
			);
			assert.equal(decision.kind, "subscription");
			if (decision.kind !== "subscription") {
				continue;
			}
			assert.equal(decision.patch.status, status);
			assert.equal(decision.patch.userId, "user_123");
			assert.equal(decision.patch.customerId, "cus_123");
			assert.equal(decision.patch.subscriptionId, "sub_123");
			assert.equal(decision.patch.productId, "pdt_123");
			assert.equal(
				decision.patch.currentPeriodStart?.toISOString(),
				"2026-04-01T00:00:00.000Z",
			);
			assert.equal(
				decision.patch.currentPeriodEnd?.toISOString(),
				"2026-05-01T00:00:00.000Z",
			);
			assert.equal(
				decision.patch.cancelAtPeriodEnd,
				type === "subscription.active",
			);
		}
	});

	it("records payment events without a subscription write", async () => {
		for (const type of [
			"payment.succeeded",
			"payment.failed",
			"payment.processing",
			"payment.cancelled",
		]) {
			const decision = mapWebhookEvent({
				business_id: "bus_123",
				type,
				timestamp: "2026-04-15T12:00:00.000Z",
				data: { payment_id: "pay_123", subscription_id: "sub_123" },
			});
			assert.deepEqual(decision, { kind: "payment", eventType: type });
			const { store, upserts } = memoryStore();
			const outcome = await processVerifiedWebhook(
				{
					webhookId: `msg_${type}`,
					event: {
						type,
						timestamp: "2026-04-15T12:00:00.000Z",
						data: { payment_id: "pay_123" },
					},
				},
				store,
			);
			assert.equal(outcome, "applied");
			assert.equal(upserts.length, 0);
		}
	});

	it("skips a duplicate delivery and an older subscription event", async () => {
		const { store, upserts } = memoryStore();
		const event = subscriptionEvent("subscription.active");
		assert.equal(
			await processVerifiedWebhook({ webhookId: "msg_1", event }, store),
			"applied",
		);
		assert.equal(
			await processVerifiedWebhook({ webhookId: "msg_1", event }, store),
			"duplicate",
		);
		assert.equal(upserts.length, 1);

		const older = subscriptionEvent("subscription.renewed");
		older.timestamp = "2026-04-01T00:00:00.000Z";
		assert.equal(
			shouldApplySubscriptionUpdate(
				new Date("2026-04-15T12:00:00.000Z"),
				new Date(older.timestamp),
			),
			false,
		);
		assert.equal(
			await processVerifiedWebhook(
				{ webhookId: "msg_old", event: older },
				store,
			),
			"ignored",
		);
		assert.equal(upserts.length, 1);
	});

	it("links a subscription by email when metadata has no user id", async () => {
		const { store, upserts } = memoryStore();
		const event = subscriptionEvent("subscription.active", {
			metadata: {},
		});
		assert.equal(
			await processVerifiedWebhook(
				{ webhookId: "msg_email", event },
				store,
			),
			"applied",
		);
		assert.equal(upserts[0]?.userId, "user_from_email");
	});

	it("verifies a standard-webhooks signature and rejects a bad one", () => {
		const payload = JSON.stringify(
			subscriptionEvent("subscription.active"),
		);
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
		assert.equal(
			(verified as { type: string }).type,
			"subscription.active",
		);
		assert.throws(() =>
			verifyWebhook(
				payload,
				{ ...headers, "webhook-signature": "v1,bad" },
				secret,
			),
		);
	});
});
