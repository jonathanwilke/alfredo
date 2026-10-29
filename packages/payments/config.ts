export type DodoEnvironment = "test_mode" | "live_mode";

export const PACK_CURRENCY = "USD" as const;

export const CREDIT_PACKS = [
	{ id: "pack_10", credits: 10, priceCents: 500 },
	{ id: "pack_20", credits: 20, priceCents: 900 },
	{ id: "pack_50", credits: 50, priceCents: 2000 },
] as const;

export type PackId = (typeof CREDIT_PACKS)[number]["id"];

const PACK_ENV: Record<PackId, string> = {
	pack_10: "DODO_PAYMENTS_PRODUCT_ID_PACK_10",
	pack_20: "DODO_PAYMENTS_PRODUCT_ID_PACK_20",
	pack_50: "DODO_PAYMENTS_PRODUCT_ID_PACK_50",
};

/** Credits granted once, on the first verified login for an email. */
export const WELCOME_CREDITS = 3;

/** Credits charged for one successful recipe generation or translation. */
export const RECIPE_CREDIT_COST = 1;

export type TokenPrice = {
	inputUsdPerMillion: number;
	outputUsdPerMillion: number;
};

/**
 * Provider list prices used to estimate what a generation costs.
 * The charge stays RECIPE_CREDIT_COST. These numbers are for tuning.
 * gemini-2.5-flash-lite public rates, USD per 1M tokens.
 */
export const MODEL_TOKEN_PRICES: Record<string, TokenPrice> = {
	"google/gemini-2.5-flash-lite": {
		inputUsdPerMillion: 0.1,
		outputUsdPerMillion: 0.4,
	},
};

export const DEFAULT_MODEL_TOKEN_PRICE: TokenPrice = {
	inputUsdPerMillion: 0.1,
	outputUsdPerMillion: 0.4,
};

/** Added on top of the provider token cost when estimating a generation. */
export const GENERATION_COST_MARGIN = 0;

export type PaymentsConfig = {
	apiKey: string;
	webhookSecret: string;
	environment: DodoEnvironment | null;
	productIds: Record<PackId, string>;
	enabled: boolean;
};

function clean(value: string | undefined) {
	const trimmed = value?.trim() ?? "";
	return trimmed.length > 0 ? trimmed : "";
}

function parseEnvironment(value: string | undefined): DodoEnvironment | null {
	const trimmed = value?.trim();
	if (trimmed === "test_mode" || trimmed === "live_mode") {
		return trimmed;
	}
	return null;
}

export function isPackId(value: string): value is PackId {
	return CREDIT_PACKS.some((pack) => pack.id === value);
}

export function packById(id: string) {
	return CREDIT_PACKS.find((pack) => pack.id === id) ?? null;
}

export function packProductId(packId: PackId) {
	return clean(process.env[PACK_ENV[packId]]);
}

export function perRecipeCents(pack: { credits: number; priceCents: number }) {
	return pack.priceCents / pack.credits;
}

/** Difference versus buying the same number of recipes at the 10-pack rate. */
export function savingsCents(pack: { credits: number; priceCents: number }) {
	const base = CREDIT_PACKS[0];
	const basePerCredit = base.priceCents / base.credits;
	return pack.credits * basePerCredit - pack.priceCents;
}

export function packForProductId(productId: string) {
	const match = CREDIT_PACKS.find(
		(pack) => packProductId(pack.id) === productId,
	);
	return match ?? null;
}

export function listPacks() {
	return CREDIT_PACKS.map((pack) => ({
		id: pack.id,
		credits: pack.credits,
		priceCents: pack.priceCents,
		perRecipeCents: perRecipeCents(pack),
		savingsCents: savingsCents(pack),
		currency: PACK_CURRENCY,
	}));
}

export function getPaymentsConfig(): PaymentsConfig {
	const apiKey = clean(process.env.DODO_PAYMENTS_API_KEY);
	const webhookSecret = clean(process.env.DODO_PAYMENTS_WEBHOOK_SECRET);
	const environment = parseEnvironment(process.env.DODO_PAYMENTS_ENVIRONMENT);
	const productIds = {
		pack_10: packProductId("pack_10"),
		pack_20: packProductId("pack_20"),
		pack_50: packProductId("pack_50"),
	} satisfies Record<PackId, string>;
	const packsReady = CREDIT_PACKS.every(
		(pack) => productIds[pack.id].length > 0,
	);

	return {
		apiKey,
		webhookSecret,
		environment,
		productIds,
		enabled: Boolean(apiKey && environment && packsReady),
	};
}
