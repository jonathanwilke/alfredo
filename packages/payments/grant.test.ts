import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	amountBeforeTax,
	decideCreditGrant,
	parseSucceededPayment,
} from "./grant";

const checkout = {
	id: "chk_20",
	userId: "user_123",
	packId: "pack_20",
	credits: 20,
	priceCents: 900,
	status: "pending" as const,
	paymentId: null,
};

function payment(overrides: Record<string, unknown> = {}) {
	return parseSucceededPayment({
		type: "payment.succeeded",
		data: {
			payment_id: "pay_20",
			currency: "USD",
			total_amount: 900,
			tax: 0,
			checkout_session_id: "ses_20",
			product_cart: [{ product_id: "pdt_credits", quantity: 1 }],
			metadata: {
				checkout_id: "chk_20",
				pack: "pack_20",
				credits: "20",
				user_id: "user_123",
				price_cents: "900",
			},
			...overrides,
		},
	});
}

describe("credit payment grant", () => {
	it("reads pack metadata and the pre-tax amount", () => {
		const parsed = payment({ total_amount: 1080, tax: 180 });
		assert.ok(parsed);
		assert.equal(parsed?.packId, "pack_20");
		assert.equal(parsed?.credits, 20);
		assert.equal(parsed?.priceCents, 900);
		assert.equal(parsed?.checkoutId, "chk_20");
		assert.equal(amountBeforeTax(1080, 180), 900);
		assert.equal(parsed?.amountBeforeTax, 900);
	});

	it("grants the checkout row when metadata and the paid amount agree", () => {
		const parsed = payment();
		assert.ok(parsed);
		const verdict = decideCreditGrant({
			payment: parsed,
			checkout,
			productId: "pdt_credits",
		});
		assert.equal(verdict.ok, true);
		if (verdict.ok) {
			assert.equal(verdict.credits, 20);
			assert.equal(verdict.packId, "pack_20");
			assert.equal(verdict.idempotent, false);
		}
	});

	it("rejects a metadata pack or credit count that does not match the row", () => {
		const parsed = payment({
			metadata: {
				checkout_id: "chk_20",
				pack: "pack_50",
				credits: "50",
				user_id: "user_123",
				price_cents: "900",
			},
		});
		assert.ok(parsed);
		const verdict = decideCreditGrant({
			payment: parsed,
			checkout,
			productId: "pdt_credits",
		});
		assert.deepEqual(verdict, {
			ok: false,
			reason: "pack-mismatch",
			checkoutId: "chk_20",
		});
	});

	it("rejects a tampered amount below the checkout price", () => {
		const parsed = payment({ total_amount: 100, tax: 0 });
		assert.ok(parsed);
		const verdict = decideCreditGrant({
			payment: parsed,
			checkout,
			productId: "pdt_credits",
		});
		assert.equal(verdict.ok, false);
		if (!verdict.ok) {
			assert.equal(verdict.reason, "amount-mismatch");
		}
	});

	it("grants a discounted payment, including a full discount", () => {
		const parsed = payment({
			total_amount: 0,
			tax: 0,
			discount_id: "dsc_full",
			discounts: [{ discount_id: "dsc_full" }],
		});
		assert.ok(parsed);
		assert.equal(parsed?.discounted, true);
		const verdict = decideCreditGrant({
			payment: parsed,
			checkout,
			productId: "pdt_credits",
		});
		assert.equal(verdict.ok, true);
		if (verdict.ok) {
			assert.equal(verdict.credits, 20);
		}
	});

	it("treats a repeated payment for an already granted checkout as idempotent", () => {
		const parsed = payment();
		assert.ok(parsed);
		const verdict = decideCreditGrant({
			payment: parsed,
			checkout: { ...checkout, status: "granted", paymentId: "pay_20" },
			productId: "pdt_credits",
		});
		assert.equal(verdict.ok, true);
		if (verdict.ok) {
			assert.equal(verdict.idempotent, true);
			assert.equal(verdict.credits, checkout.credits);
		}
	});
});
