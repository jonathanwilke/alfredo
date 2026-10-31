import { generateText, Output } from "ai";
import { z } from "zod";

export const ingredientSchema = z.object({
	id: z.string().describe("Stable id referenced by steps."),
	name: z.string(),
	canonicalKey: z
		.string()
		.describe(
			"English singular lowercase name used as the global icon cache key. onion, not onions or Zwiebel.",
		),
	quantity: z
		.number()
		.nullable()
		.describe(
			"Numeric amount before unit conversion. Null when unmeasured.",
		),
	unit: z.string().nullable(),
	form: z
		.string()
		.nullable()
		.optional()
		.describe(
			"Size, origin, variety, or preparation in base form, such as mittelgroß, italienisch, or gehackt. Null when there is none. Do not repeat it in the name.",
		),
});

export const stepUseSchema = z.object({
	ingredientId: z.string().describe("Id of an ingredient used in this step."),
	quantity: z
		.number()
		.nullable()
		.optional()
		.describe(
			"Amount used in this step when it is only part of the ingredient. Null when the step uses the full amount.",
		),
	unit: z.string().nullable().optional(),
});

export const stepSchema = z.object({
	id: z.string(),
	text: z.string(),
	ingredientIds: z
		.array(z.string())
		.describe(
			"Ids of the ingredients used in this step, in the order they are needed.",
		),
	uses: z
		.array(stepUseSchema)
		.optional()
		.describe(
			"Same ingredients as ingredientIds. Set quantity only for a partial amount.",
		),
	timerSeconds: z
		.number()
		.int()
		.positive()
		.nullable()
		.describe(
			"Timer for this step, in seconds. Null when the step has no timer.",
		),
});

export const extractedRecipeSchema = z.object({
	title: z
		.string()
		.describe(
			"Dish name only. No subtitle, slogan, or site name after a colon, dash, or pipe.",
		),
	description: z
		.string()
		.describe(
			"One or two sentences about the finished dish. No method and no ingredient list.",
		)
		.optional(),
	image: z.string().nullable().describe("Absolute image URL, or null."),
	servings: z.number().positive(),
	prepTimeSeconds: z.number().int().nonnegative().nullable(),
	cookTimeSeconds: z.number().int().nonnegative().nullable(),
	ingredients: z.array(ingredientSchema),
	steps: z.array(stepSchema),
});

export type Ingredient = z.infer<typeof ingredientSchema>;
export type RecipeStep = z.infer<typeof stepSchema>;
export type ExtractedRecipe = z.infer<typeof extractedRecipeSchema>;

export type TokenUsage = {
	model: string;
	inputTokens: number;
	outputTokens: number;
};

/** Cheap structured-output model. Override with AI_GATEWAY_MODEL. */
export const DEFAULT_EXTRACTION_MODEL = "google/gemini-2.5-flash-lite";

export function extractionModelId() {
	const configured = process.env.AI_GATEWAY_MODEL?.trim();
	return configured || DEFAULT_EXTRACTION_MODEL;
}

/**
 * Structured extraction call. A plain provider/model string routes through
 * Vercel AI Gateway. This does not fetch or parse a recipe URL.
 */
export async function extractRecipe(input: {
	sourceText: string;
	locale: string;
}) {
	const model = extractionModelId();
	const result = await generateText({
		model,
		output: Output.object({ schema: extractedRecipeSchema }),
		prompt: [
			"Extract one cooking recipe from the source text.",
			`Write every user-facing string in the locale "${input.locale}".`,
			'Set title to the dish name only. Drop subtitles, slogans, and site names. "Chicken Alfredo: das cremige Wohlfühlessen" is "Chicken Alfredo".',
			"Write description as one or two short sentences about what the dish is. Do not put the method or the ingredient list there.",
			"Use seconds for every duration.",
			"Give each ingredient a stable id and reference those ids from steps.",
			"For each step, set ingredientIds to every ingredient that step uses, in the order they are needed.",
			"Set uses to those same ids. Leave quantity and unit null when the step uses the full listed amount. Set them only when the step uses part of it, such as half the cream or 100 g of a 200 g pasta portion.",
			"In each step, use the ingredient's name exactly as written in the ingredient list.",
			'Name is only the base ingredient. Put size, origin, variety, and preparation in form, in base form. "mittelgroße Zwiebel" is name "Zwiebel" and form "mittelgroß". "italienischer Pancetta" is name "Pancetta" and form "italienisch". "gehackte Petersilie" is name "Petersilie" and form "gehackt". Use null when there is no attribute.',
			"Set canonicalKey to one English singular lowercase word or short hyphenated phrase, the same for every language.",
			"Source:",
			input.sourceText,
		].join("\n\n"),
	});

	if (!result.output) {
		return null;
	}

	return {
		recipe: {
			...result.output,
			title: dishName(result.output.title),
		},
		usage: {
			model,
			inputTokens: result.usage.inputTokens ?? 0,
			outputTokens: result.usage.outputTokens ?? 0,
		} satisfies TokenUsage,
	};
}

/** Keeps the dish name and drops a subtitle after a colon, dash, or pipe. */
export function dishName(title: string) {
	const trimmed = title.trim().replace(/\s+/g, " ");
	const name = trimmed.split(/\s+[|–—]\s+|\s+-\s+|:\s+/)[0]?.trim();
	return name || trimmed;
}

export async function describeDish(input: {
	title: string;
	ingredients: string[];
	locale: string;
}) {
	const result = await generateText({
		model: extractionModelId(),
		prompt: [
			`Write one or two sentences in the locale "${input.locale}" about the dish "${input.title}".`,
			"Say what it is, not how to cook it, and do not list the ingredients.",
			`Ingredients for context: ${input.ingredients.join(", ")}.`,
		].join(" "),
	});

	return result.text.trim();
}

const JEV_GATEWAY_URL = "https://ai-gateway.vercel.sh/typesafe/v1/systemone";
const JEV_MODEL = "typesafe-ai/jev";
const RECIPE_URL_THRESHOLD = 0.7;

export class RecipeUrlCheckError extends Error {
	constructor(readonly reason: "not_configured" | "unavailable") {
		super(reason);
		this.name = "RecipeUrlCheckError";
	}
}

function gatewayToken() {
	const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
	if (apiKey) {
		return apiKey;
	}

	const oidc = process.env.VERCEL_OIDC_TOKEN?.trim();
	if (oidc) {
		return oidc;
	}

	throw new RecipeUrlCheckError("not_configured");
}

/**
 * Jev decision on the URL alone. True when it looks like one recipe page.
 * Does not fetch the page.
 */
export async function recipeUrlLooksLegitimate(url: string) {
	let response: Response;
	try {
		response = await fetch(JEV_GATEWAY_URL, {
			method: "POST",
			redirect: "error",
			headers: {
				Authorization: `Bearer ${gatewayToken()}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: JEV_MODEL,
				state: { url },
				questions: {
					"recipe-url": {
						type: "noul",
						instructions:
							"From the URL alone, does it look like a link to one recipe a person would cook from? Do not assume the page can be opened.",
						criteria: {
							true: "The URL is an http or https link to a specific dish on a food site, recipe publisher, blog, or cookbook. A descriptive path is enough; the word recipe is not required.",
							false: "The URL is not one recipe. That includes homepages, search or category pages, social and video homepages, login or account pages, shorteners with no article path, IP addresses, files unrelated to cooking, and anything that is not a recipe.",
						},
					},
				},
			}),
		});
	} catch (error) {
		if (error instanceof RecipeUrlCheckError) {
			throw error;
		}
		throw new RecipeUrlCheckError("unavailable");
	}

	if (response.status === 401 || response.status === 403) {
		throw new RecipeUrlCheckError("not_configured");
	}

	if (!response.ok) {
		throw new RecipeUrlCheckError("unavailable");
	}

	const payload = (await response.json()) as {
		answers?: Record<string, { noul?: number }>;
	};
	const noul = payload.answers?.["recipe-url"]?.noul;
	if (typeof noul !== "number") {
		throw new RecipeUrlCheckError("unavailable");
	}

	return noul >= RECIPE_URL_THRESHOLD;
}
