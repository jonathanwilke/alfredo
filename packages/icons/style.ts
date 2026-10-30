export const ICON_STYLE_PROMPT = [
	"A single cute 3D food icon, soft clay toy render, warm natural colors.",
	"Slightly isometric view, centered, generous padding, square frame.",
	"Soft studio shadow on a plain warm cream background #F3EDE3.",
	"No text, no label, no watermark, no extra props.",
].join(" ");

const INGREDIENT_FORM_PROMPT = [
	"Show the ingredient raw, as it is before any cooking.",
	"Whole produce, a raw cut of meat or fish, an egg in its shell, a piece of dairy, or dry uncooked grains or pasta.",
	"Do not cook, fry, bake, melt, sauce, or plate it as a meal.",
	"If it is a spice, dried herb, seed, or ground seasoning, put only that raw spice in a small round unglazed terracotta pinch bowl, heaped in the bowl, centered on the cream background.",
	"Fresh vegetables and fresh chilies stay whole and raw, not in a bowl. No spoon, jar, packet, or label.",
].join(" ");

export const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";

/**
 * Gemini image config for ingredient icons (frame "square").
 * `imageSize: "512"` is the 0.5K output (512×512 at 1:1). The API rejects
 * `"0.5K"` and `"512px"`. Recipe photos do not use this config.
 */
export const INGREDIENT_IMAGE_CONFIG = {
	aspectRatio: "1:1",
	imageSize: "512",
} as const;

export function imageModelId() {
	return process.env.AI_GATEWAY_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
}

export interface DishPromptIngredient {
	canonicalKey: string;
	form?: string | null;
}

export interface DishPromptSource {
	locale: string;
	title: string;
	ingredients: DishPromptIngredient[];
}

const DISH_ONLY_THESE = [
	"Show only these ingredients; do not add any other ingredients, garnishes, herbs, vegetables, sauces or side dishes that are not listed.",
	"Salt, pepper and oil may be invisible.",
].join(" ");

const DISH_PROPS = [
	"Plates, cutlery, glasses of water, and napkins are allowed.",
	"Do not add extra food side dishes, such as fries, unless they are listed.",
].join(" ");

export function dishIngredientLabel(ingredient: DishPromptIngredient) {
	const name = ingredient.canonicalKey.replaceAll("-", " ").trim();
	const form = ingredient.form?.trim() ?? "";
	if (!name) {
		return "";
	}
	if (!form) {
		return name;
	}
	return `${name} (${form})`;
}

/**
 * English translation when one is stored; otherwise the fullest list.
 * canonicalKey is the English ingredient name. Form comes from that same translation.
 */
export function dishPromptInput(
	translations: DishPromptSource[],
	fallbackTitle = "",
) {
	if (translations.length === 0) {
		const title = fallbackTitle.trim();
		if (!title) {
			return null;
		}
		return { title, ingredients: [] as DishPromptIngredient[] };
	}

	const english = translations.find((item) => item.locale === "en");
	const source =
		english ??
		translations.reduce((fullest, item) =>
			item.ingredients.length > fullest.ingredients.length
				? item
				: fullest,
		);
	const title = source.title.trim() || fallbackTitle.trim();
	const ingredients: DishPromptIngredient[] = [];
	const seen = new Set<string>();

	for (const ingredient of source.ingredients) {
		const canonicalKey = ingredient.canonicalKey.trim();
		const key = canonicalKey.toLowerCase();
		if (!key || seen.has(key)) {
			continue;
		}
		seen.add(key);
		ingredients.push({
			canonicalKey,
			form: ingredient.form?.trim() || null,
		});
	}

	return { title, ingredients };
}

export function iconPrompt(input: {
	title: string;
	ingredients: DishPromptIngredient[];
}) {
	const listed = input.ingredients
		.map(dishIngredientLabel)
		.filter((label) => label.length > 0);
	const ingredients =
		listed.length > 0
			? `Ingredients: ${listed.join("; ")}.`
			: "Ingredients: none listed.";

	return [
		"A photorealistic cookbook photograph, wide 16:9 frame.",
		"The finished dish is served and ready to eat, centered, filling most of the frame.",
		"Serve it on a beautiful ceramic plate or bowl that suits the food.",
		"The plate sits in a warm matching setting, such as a wooden table, linen, or stone, with soft natural window light and a gentle shadow.",
		"Overhead or a slight three-quarter view. Editorial food photography, appetizing and real.",
		"No text, no logo, no watermark, no people, no hands.",
		"Not an illustration, not clay, not a toy, not a 3D icon.",
		`Subject: the finished dish, ${input.title}.`,
		ingredients,
		DISH_ONLY_THESE,
		DISH_PROPS,
	].join(" ");
}

export function ingredientIconPrompt(subject: string) {
	return `${ICON_STYLE_PROMPT} ${INGREDIENT_FORM_PROMPT} Subject: raw ${subject}.`;
}

export function shouldMockIconGeneration() {
	if (process.env.ICON_GENERATION_MODE === "mock") {
		return true;
	}

	if (process.env.ICON_GENERATION_MODE === "live") {
		return false;
	}

	return !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN;
}

export function normalizeIngredientKey(value: string) {
	const key = value
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	if (!key) {
		throw new Error("Ingredient icon key is empty.");
	}

	return key;
}
