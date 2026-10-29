import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estimateGenerationCost } from "./cost";
import { applyDebit } from "./ledger";
import { createMemoryStore } from "./memory-store";
import {
	passiveRecipeUse,
	resolveRecipeCharge,
	starterCount,
	userImportedRecipeValues,
} from "./recipe-access";
import { applyWelcomeGrant } from "./welcome";

const curated = { isCurated: true, locales: ["de"] };
const userRecipe = { isCurated: false, locales: ["de"] };

describe("curated recipes", () => {
	it("never debits or records usage for view, cook, save, paste, or translation", async () => {
		const memory = createMemoryStore();
		await applyWelcomeGrant(memory.store, {
			userId: "user_1",
			email: "cook@example.com",
			emailVerified: true,
		});
		const usage: unknown[] = [];

		const decisions = [
			resolveRecipeCharge({
				existing: curated,
				requestedLocale: "de",
			}),
			passiveRecipeUse(),
			passiveRecipeUse(),
			resolveRecipeCharge({
				existing: { isCurated: true, locales: ["de", "en"] },
				requestedLocale: "en",
			}),
			resolveRecipeCharge({
				existing: curated,
				requestedLocale: "en",
			}),
		];

		for (const [index, decision] of decisions.entries()) {
			assert.equal(decision.charge, 0);
			assert.equal(decision.recordUsage, false);
			assert.equal(decision.estimateCost, false);
			if (decision.estimateCost) {
				usage.push(
					estimateGenerationCost({
						model: "google/gemini-2.5-flash-lite",
						inputTokens: 10,
						outputTokens: 10,
					}),
				);
			}
			if (decision.charge > 0) {
				await applyDebit(memory.store, {
					userId: "user_1",
					cost: decision.charge,
					idempotencyKey: `import:${index}`,
					usage: {
						model: "google/gemini-2.5-flash-lite",
						inputTokens: 10,
						outputTokens: 10,
						estimatedCostMicroUsd: 1,
					},
				});
			}
		}

		assert.equal(usage.length, 0);
		assert.equal(memory.balance("user_1"), 3);
		assert.equal(
			[...memory.entries.values()].some(
				(entry) => entry.type === "import",
			),
			false,
		);
		assert.equal(
			[...memory.entries.values()].some(
				(entry) =>
					entry.inputTokens != null ||
					entry.estimatedCostMicroUsd != null,
			),
			false,
		);
	});

	it("serves a pasted curated URL and a missing language without generating", () => {
		const pasted = resolveRecipeCharge({
			existing: { isCurated: true, locales: ["de", "en"] },
			requestedLocale: "de",
		});
		assert.equal(pasted.action, "serve");
		assert.equal(pasted.reason, "curated");
		assert.equal(pasted.charge, 0);

		const missing = resolveRecipeCharge({
			existing: curated,
			requestedLocale: "en",
		});
		assert.equal(missing.action, "serve");
		assert.equal(missing.reason, "curated-fallback");
		assert.equal(missing.locale, "de");
		assert.equal(missing.recordUsage, false);
	});

	it("charges a user import and a user translation, and never marks them curated", () => {
		const imported = resolveRecipeCharge({
			existing: null,
			requestedLocale: "de",
		});
		const translated = resolveRecipeCharge({
			existing: userRecipe,
			requestedLocale: "en",
		});
		assert.equal(imported.action, "generate");
		assert.equal(imported.reason, "import");
		assert.equal(imported.charge, 1);
		assert.equal(imported.recordUsage, true);
		assert.equal(translated.reason, "translation");
		assert.equal(translated.estimateCost, true);

		const row = userImportedRecipeValues("https://example.com/pasta");
		assert.equal(row.isCurated, false);
		assert.equal(row.source, "import");
	});

	it("shows four to six starters when the collection is large", () => {
		assert.equal(starterCount(0), 0);
		assert.equal(
			starterCount(2, () => 0),
			2,
		);
		assert.equal(
			starterCount(40, () => 0),
			4,
		);
		assert.equal(
			starterCount(40, () => 0.5),
			5,
		);
		assert.equal(
			starterCount(40, () => 0.99),
			6,
		);
	});
});
