import {
	CREDIT_PACKS,
	DEFAULT_MODEL_TOKEN_PRICE,
	GENERATION_COST_MARGIN,
	MODEL_TOKEN_PRICES,
} from "./config";

export type GenerationUsage = {
	model: string;
	inputTokens: number;
	outputTokens: number;
};

export type GenerationCost = {
	tokenUsd: number;
	usdWithMargin: number;
	estimatedCostMicroUsd: number;
	/** Token cost expressed at the 10-pack rate. Recorded for tuning, not charged. */
	equivalentCredits: number;
};

export function estimateGenerationCost(usage: GenerationUsage): GenerationCost {
	const price = MODEL_TOKEN_PRICES[usage.model] ?? DEFAULT_MODEL_TOKEN_PRICE;
	const inputTokens = Math.max(0, usage.inputTokens);
	const outputTokens = Math.max(0, usage.outputTokens);
	const tokenUsd =
		(inputTokens * price.inputUsdPerMillion +
			outputTokens * price.outputUsdPerMillion) /
		1_000_000;
	const usdWithMargin = tokenUsd * (1 + GENERATION_COST_MARGIN);
	const creditValueUsd =
		CREDIT_PACKS[0].priceCents / CREDIT_PACKS[0].credits / 100;
	const equivalentCredits =
		creditValueUsd > 0 ? usdWithMargin / creditValueUsd : 0;

	return {
		tokenUsd,
		usdWithMargin,
		estimatedCostMicroUsd: Math.max(
			0,
			Math.round(usdWithMargin * 1_000_000),
		),
		equivalentCredits,
	};
}
