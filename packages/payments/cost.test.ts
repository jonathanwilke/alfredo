import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CREDIT_PACKS,
	GENERATION_COST_MARGIN,
	PACK_CURRENCY,
	perRecipeCents,
	RECIPE_CREDIT_COST,
	savingsCents,
	WELCOME_CREDITS,
} from "./config";
import { estimateGenerationCost } from "./cost";

describe("pricing", () => {
	it("uses the volume prices Jonathan set", () => {
		assert.deepEqual(
			CREDIT_PACKS.map((pack) => ({
				id: pack.id,
				credits: pack.credits,
				priceCents: pack.priceCents,
				perRecipeCents: perRecipeCents(pack),
				savingsCents: savingsCents(pack),
				currency: PACK_CURRENCY,
			})),
			[
				{
					id: "pack_10",
					credits: 10,
					priceCents: 500,
					perRecipeCents: 50,
					savingsCents: 0,
					currency: "USD",
				},
				{
					id: "pack_20",
					credits: 20,
					priceCents: 900,
					perRecipeCents: 45,
					savingsCents: 100,
					currency: "USD",
				},
				{
					id: "pack_50",
					credits: 50,
					priceCents: 2000,
					perRecipeCents: 40,
					savingsCents: 500,
					currency: "USD",
				},
			],
		);
		assert.equal(RECIPE_CREDIT_COST, 1);
		assert.equal(WELCOME_CREDITS, 3);
	});

	it("estimates token cost without changing the one-credit charge", () => {
		const cost = estimateGenerationCost({
			model: "google/gemini-2.5-flash-lite",
			inputTokens: 1_000_000,
			outputTokens: 1_000_000,
		});
		const raw = 0.1 + 0.4;
		assert.equal(cost.tokenUsd, raw);
		assert.equal(cost.usdWithMargin, raw * (1 + GENERATION_COST_MARGIN));
		assert.equal(
			cost.estimatedCostMicroUsd,
			Math.round(cost.usdWithMargin * 1_000_000),
		);
		assert.equal(RECIPE_CREDIT_COST, 1);
	});
});
