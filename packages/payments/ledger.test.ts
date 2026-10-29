import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RECIPE_CREDIT_COST } from "./config";
import {
	applyDebit,
	applyGrant,
	applyReversal,
	InsufficientCreditsError,
} from "./ledger";
import { createMemoryStore } from "./memory-store";

describe("credit ledger", () => {
	it("grants a purchase once for the same payment", async () => {
		const memory = createMemoryStore();
		const entry = {
			userId: "user_1",
			amount: 10,
			type: "purchase" as const,
			idempotencyKey: "purchase:pay_1",
			paymentId: "pay_1",
			packId: "pack_10",
		};

		assert.equal(await applyGrant(memory.store, entry), "granted");
		assert.equal(await applyGrant(memory.store, entry), "duplicate");
		assert.equal(memory.balance("user_1"), 10);
	});

	it("debits one credit and records token usage on the ledger row", async () => {
		const memory = createMemoryStore();
		await applyGrant(memory.store, {
			userId: "user_1",
			amount: 3,
			type: "welcome",
			idempotencyKey: "welcome:user_1",
		});

		const result = await memory.transaction(() =>
			applyDebit(memory.store, {
				userId: "user_1",
				cost: RECIPE_CREDIT_COST,
				idempotencyKey: "import:user_1:recipe:de",
				usage: {
					model: "google/gemini-2.5-flash-lite",
					inputTokens: 800,
					outputTokens: 200,
					estimatedCostMicroUsd: 160,
				},
			}),
		);

		assert.equal(result.debited, true);
		assert.equal(result.balance, 2);
		const row = memory.entries.get("import:user_1:recipe:de");
		assert.equal(row?.amount, -1);
		assert.equal(row?.inputTokens, 800);
		assert.equal(row?.outputTokens, 200);
		assert.equal(row?.estimatedCostMicroUsd, 160);

		const again = await memory.transaction(() =>
			applyDebit(memory.store, {
				userId: "user_1",
				cost: RECIPE_CREDIT_COST,
				idempotencyKey: "import:user_1:recipe:de",
				usage: {
					model: "google/gemini-2.5-flash-lite",
					inputTokens: 800,
					outputTokens: 200,
					estimatedCostMicroUsd: 160,
				},
			}),
		);
		assert.equal(again.debited, false);
		assert.equal(memory.balance("user_1"), 2);
	});

	it("refuses a debit at zero and leaves the balance unchanged", async () => {
		const memory = createMemoryStore();
		await assert.rejects(
			() =>
				memory.transaction(() =>
					applyDebit(memory.store, {
						userId: "user_1",
						cost: 1,
						idempotencyKey: "import:user_1:recipe:de",
					}),
				),
			(error: unknown) => {
				assert.ok(error instanceof InsufficientCreditsError);
				assert.equal(error.balance, 0);
				return true;
			},
		);
		assert.equal(memory.balance("user_1"), 0);
		assert.equal(memory.entries.size, 0);
	});

	it("lets only one of two concurrent debits spend the last credit", async () => {
		const memory = createMemoryStore();
		await applyGrant(memory.store, {
			userId: "user_1",
			amount: 1,
			type: "purchase",
			idempotencyKey: "purchase:pay_1",
			paymentId: "pay_1",
		});

		const results = await Promise.allSettled([
			memory.transaction(() =>
				applyDebit(memory.store, {
					userId: "user_1",
					cost: 1,
					idempotencyKey: "import:a",
				}),
			),
			memory.transaction(() =>
				applyDebit(memory.store, {
					userId: "user_1",
					cost: 1,
					idempotencyKey: "import:b",
				}),
			),
		]);

		const fulfilled = results.filter(
			(result) => result.status === "fulfilled",
		);
		const rejected = results.filter(
			(result) => result.status === "rejected",
		);
		assert.equal(fulfilled.length, 1);
		assert.equal(rejected.length, 1);
		assert.ok(rejected[0]?.reason instanceof InsufficientCreditsError);
		assert.equal(memory.balance("user_1"), 0);
	});

	it("reverses a purchase once for a refund and again for a dispute", async () => {
		const memory = createMemoryStore();
		await applyGrant(memory.store, {
			userId: "user_1",
			amount: 20,
			type: "purchase",
			idempotencyKey: "purchase:pay_20",
			paymentId: "pay_20",
			packId: "pack_20",
		});
		await applyGrant(memory.store, {
			userId: "user_1",
			amount: 3,
			type: "welcome",
			idempotencyKey: "welcome:user_1",
		});

		assert.equal(
			await applyReversal(memory.store, {
				paymentId: "pay_20",
				type: "refund",
			}),
			"granted",
		);
		assert.equal(memory.balance("user_1"), 3);
		assert.equal(
			await applyReversal(memory.store, {
				paymentId: "pay_20",
				type: "dispute",
			}),
			"duplicate",
		);
		assert.equal(memory.balance("user_1"), 3);
		assert.equal(
			await applyReversal(memory.store, {
				paymentId: "missing",
				type: "refund",
			}),
			"ignored",
		);
	});
});
