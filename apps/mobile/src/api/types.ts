import { z } from "zod";

export const localeSchema = z.enum(["de", "en"]);
export type Locale = z.infer<typeof localeSchema>;

export const ingredientSchema = z.object({
	id: z.string(),
	name: z.string(),
	canonicalKey: z.string().optional(),
	quantity: z.number().nullable(),
	unit: z.string().nullable(),
	form: z.string().nullable().optional(),
});

export const stepSchema = z.object({
	id: z.string(),
	text: z.string(),
	ingredientIds: z.array(z.string()),
	uses: z
		.array(
			z.object({
				ingredientId: z.string(),
				quantity: z.number().nullable().optional(),
				unit: z.string().nullable().optional(),
			}),
		)
		.optional(),
	timerSeconds: z.number().int().positive().nullable().optional(),
});

export const recipeContentSchema = z.object({
	title: z.string(),
	description: z.string().optional(),
	image: z.string().nullable().optional(),
	servings: z.number().positive(),
	prepTimeSeconds: z.number().int().nonnegative().nullable(),
	cookTimeSeconds: z.number().int().nonnegative().nullable(),
	ingredients: z.array(ingredientSchema),
	steps: z.array(stepSchema),
});

export const storedRecipeSchema = z.object({
	recipeId: z.string(),
	sourceUrl: z.string(),
	content: recipeContentSchema,
	isCurated: z.boolean(),
	servedLocale: z.string(),
	isOwner: z.boolean().optional(),
	shared: z.boolean().optional(),
	attributionUrl: z.string().nullable().optional(),
});

export const starterSchema = z.object({
	recipeId: z.string(),
	title: z.string(),
	servedLocale: z.string(),
	image: z.string().nullable().optional(),
	heroIconUrl: z.string().nullable().optional(),
	servings: z.number().positive().optional(),
	totalTimeSeconds: z.number().int().nonnegative().nullable().optional(),
});

export const iconSchema = z.object({
	id: z.string(),
	kind: z.enum(["ingredient", "recipe"]),
	key: z.string(),
	status: z.enum(["pending", "ready", "failed"]),
	url: z.string().nullable(),
});

export const balanceSchema = z.object({
	authenticated: z.boolean(),
	billingEnabled: z.boolean(),
	balance: z.number().int(),
	welcomeCredits: z.number().int().nonnegative(),
	recipeCreditCost: z.number().int().positive(),
});

export const historyEntrySchema = z.object({
	id: z.string(),
	type: z.enum([
		"welcome",
		"purchase",
		"import",
		"refund",
		"dispute",
		"adjustment",
	]),
	amount: z.number().int(),
	createdAt: z.string(),
	packId: z.string().nullable(),
});

export type RecipeContent = z.infer<typeof recipeContentSchema>;
export type StoredRecipe = z.infer<typeof storedRecipeSchema>;
export type StarterRecipe = z.infer<typeof starterSchema>;
export type RecipeIcon = z.infer<typeof iconSchema>;
export const creditUsageSchema = z.object({
	total: z.number().int().nonnegative(),
	used: z.number().int().nonnegative(),
	remaining: z.number().int().nonnegative(),
});

export type CreditBalance = z.infer<typeof balanceSchema>;
export type CreditEntry = z.infer<typeof historyEntrySchema>;
export type CreditUsage = z.infer<typeof creditUsageSchema>;
export type IconStatus = RecipeIcon["status"];
