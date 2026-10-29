import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WELCOME_CREDITS } from "./config";
import { normalizeEmail } from "./email";
import { applyDebit, InsufficientCreditsError } from "./ledger";
import { createMemoryStore } from "./memory-store";
import { applyWelcomeGrant } from "./welcome";

const cook = {
	userId: "user_cook",
	email: "Cook+tag@Gmail.com",
	emailVerified: true,
};

describe("welcome credits", () => {
	it("normalizes gmail dots and plus tags onto one address", () => {
		assert.equal(normalizeEmail("Cook+tag@Gmail.com"), "cook@gmail.com");
		assert.equal(
			normalizeEmail("c.o.o.k+news@googlemail.com"),
			"cook@gmail.com",
		);
		assert.equal(
			normalizeEmail("c.o.o.k+x@example.com"),
			"c.o.o.k@example.com",
		);
	});

	it("grants three credits once on a verified login", async () => {
		const memory = createMemoryStore();
		const first = await applyWelcomeGrant(memory.store, cook);
		const second = await applyWelcomeGrant(memory.store, cook);

		assert.equal(first.granted, true);
		assert.equal(first.amount, WELCOME_CREDITS);
		assert.equal(second.granted, false);
		assert.equal(second.reason, "email-used");
		assert.equal(memory.balance(cook.userId), 3);
		assert.equal(
			[...memory.entries.values()].filter(
				(entry) => entry.type === "welcome",
			).length,
			1,
		);
	});

	it("grants once when two logins race", async () => {
		const memory = createMemoryStore();
		const [first, second] = await Promise.all([
			memory.transaction(() => applyWelcomeGrant(memory.store, cook)),
			memory.transaction(() => applyWelcomeGrant(memory.store, cook)),
		]);
		const granted = [first, second].filter((result) => result.granted);
		assert.equal(granted.length, 1);
		assert.equal(memory.balance(cook.userId), WELCOME_CREDITS);
	});

	it("does not grant again for an alias or a deleted account", async () => {
		const memory = createMemoryStore();
		await applyWelcomeGrant(memory.store, cook);
		memory.deleteUser(cook.userId);

		const alias = await applyWelcomeGrant(memory.store, {
			userId: "user_alias",
			email: "c.o.o.k+other@googlemail.com",
			emailVerified: true,
		});
		assert.equal(alias.granted, false);
		assert.equal(alias.reason, "email-used");
		assert.equal(memory.balance("user_alias"), 0);
		assert.equal(memory.emails.has("cook@gmail.com"), true);
	});

	it("skips unverified and disposable addresses", async () => {
		const memory = createMemoryStore();
		const unverified = await applyWelcomeGrant(memory.store, {
			...cook,
			emailVerified: false,
		});
		const disposable = await applyWelcomeGrant(memory.store, {
			userId: "user_temp",
			email: "cook@mailinator.com",
			emailVerified: true,
		});
		assert.equal(unverified.reason, "unverified");
		assert.equal(disposable.reason, "disposable");
		assert.equal(memory.emails.size, 0);
		assert.equal(memory.balance(cook.userId), 0);
	});

	it("consumes welcome credits like any other credit", async () => {
		const memory = createMemoryStore();
		await applyWelcomeGrant(memory.store, cook);
		for (let index = 0; index < WELCOME_CREDITS; index += 1) {
			await memory.transaction(() =>
				applyDebit(memory.store, {
					userId: cook.userId,
					cost: 1,
					idempotencyKey: `import:${index}`,
				}),
			);
		}
		assert.equal(memory.balance(cook.userId), 0);
		await assert.rejects(
			() =>
				memory.transaction(() =>
					applyDebit(memory.store, {
						userId: cook.userId,
						cost: 1,
						idempotencyKey: "import:again",
					}),
				),
			InsufficientCreditsError,
		);
	});
});
