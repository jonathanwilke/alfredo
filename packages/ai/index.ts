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
	title: z.string(),
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

/**
 * Structured extraction call. A plain provider/model string routes through
 * Vercel AI Gateway. This does not fetch or parse a recipe URL.
 */
export async function extractRecipe(input: {
	sourceText: string;
	locale: string;
}) {
	const model = process.env.AI_GATEWAY_MODEL;

	if (!model) {
		throw new Error(
			"AI_GATEWAY_MODEL is not set. Use a provider/model id returned by AI Gateway.",
		);
	}

	const result = await generateText({
		model,
		output: Output.object({ schema: extractedRecipeSchema }),
		prompt: [
			"Extract one cooking recipe from the source text.",
			`Write every user-facing string in the locale "${input.locale}".`,
			"Use seconds for every duration.",
			"Give each ingredient a stable id and reference those ids from steps.",
			"Set canonicalKey to one English singular lowercase word or short hyphenated phrase, the same for every language.",
			"Source:",
			input.sourceText,
		].join("\n\n"),
	});

	return result.output;
}
