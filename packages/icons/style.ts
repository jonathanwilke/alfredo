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

export function iconPrompt(subject: string) {
	return [
		"A photorealistic cookbook photograph, wide 16:9 frame.",
		"The finished dish is served and ready to eat, centered, filling most of the frame.",
		"Serve it on a beautiful ceramic plate or bowl that suits the food.",
		"The plate sits in a warm matching setting, such as a wooden table, linen, or stone, with soft natural window light and a gentle shadow.",
		"Overhead or a slight three-quarter view. Editorial food photography, appetizing and real.",
		"No text, no logo, no watermark, no people, no hands.",
		"Not an illustration, not clay, not a toy, not a 3D icon.",
		`Subject: the finished dish, ${subject}.`,
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
