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

export const stepSchema = z.object({
	id: z.string(),
	text: z.string(),
	ingredientIds: z.array(z.string()),
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
	const result = await generateText({
		model: extractionModelId(),
		output: Output.object({ schema: extractedRecipeSchema }),
		prompt: [
			"Extract one cooking recipe from the source text.",
			`Write every user-facing string in the locale "${input.locale}".`,
			'Set title to the dish name only. Drop subtitles, slogans, and site names. "Chicken Alfredo: das cremige Wohlfühlessen" is "Chicken Alfredo".',
			"Write description as one or two short sentences about what the dish is. Do not put the method or the ingredient list there.",
			"Use seconds for every duration.",
			"Give each ingredient a stable id and reference those ids from steps.",
			"In each step, use the ingredient's name exactly as written in the ingredient list.",
			'Name is only the base ingredient. Put size, origin, variety, and preparation in form, in base form. "mittelgroße Zwiebel" is name "Zwiebel" and form "mittelgroß". "italienischer Pancetta" is name "Pancetta" and form "italienisch". "gehackte Petersilie" is name "Petersilie" and form "gehackt". Use null when there is no attribute.',
			"Set canonicalKey to one English singular lowercase word or short hyphenated phrase, the same for every language.",
			"Source:",
			input.sourceText,
		].join("\n\n"),
	});

	if (!result.output) {
		return result.output;
	}

	return {
		...result.output,
		title: dishName(result.output.title),
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
