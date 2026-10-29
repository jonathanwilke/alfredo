import { RECIPE_CREDIT_COST } from "./config";

export type RecipeCharge =
	| {
			action: "serve";
			charge: 0;
			recordUsage: false;
			estimateCost: false;
			locale: string;
			reason: "cached" | "curated" | "curated-fallback";
	  }
	| {
			action: "generate";
			charge: number;
			recordUsage: true;
			estimateCost: true;
			reason: "import" | "translation";
	  };

export function resolveRecipeCharge(input: {
	existing: { isCurated: boolean; locales: string[] } | null;
	requestedLocale: string;
}): RecipeCharge {
	if (!input.existing) {
		return {
			action: "generate",
			charge: RECIPE_CREDIT_COST,
			recordUsage: true,
			estimateCost: true,
			reason: "import",
		};
	}

	if (input.existing.locales.includes(input.requestedLocale)) {
		return {
			action: "serve",
			charge: 0,
			recordUsage: false,
			estimateCost: false,
			locale: input.requestedLocale,
			reason: input.existing.isCurated ? "curated" : "cached",
		};
	}

	if (input.existing.isCurated) {
		const locale = input.existing.locales[0] ?? input.requestedLocale;
		return {
			action: "serve",
			charge: 0,
			recordUsage: false,
			estimateCost: false,
			locale,
			reason: "curated-fallback",
		};
	}

	return {
		action: "generate",
		charge: RECIPE_CREDIT_COST,
		recordUsage: true,
		estimateCost: true,
		reason: "translation",
	};
}

/** Opening, cooking, or saving a stored recipe never generates and never bills. */
export function passiveRecipeUse() {
	return {
		charge: 0 as const,
		recordUsage: false as const,
		estimateCost: false as const,
	};
}

export function userImportedRecipeValues(sourceUrl: string) {
	return {
		sourceUrl,
		rawData: {} as Record<string, unknown>,
		isCurated: false as const,
		source: "import" as const,
	};
}

/** How many starter dishes to show. 4–6 when the collection is large enough. */
export function starterCount(available: number, random = Math.random) {
	if (available <= 0) {
		return 0;
	}
	const wanted = 4 + Math.floor(random() * 3);
	return Math.min(available, wanted);
}
