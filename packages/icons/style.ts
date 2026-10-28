export const ICON_STYLE_PROMPT = [
	"A single cute 3D food icon, soft clay toy render, warm natural colors.",
	"Slightly isometric view, centered, generous padding, square frame.",
	"Soft studio shadow on a plain warm cream background #F3EDE3.",
	"No text, no label, no watermark, no extra props.",
].join(" ");

export const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";

export function imageModelId() {
	return process.env.AI_GATEWAY_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
}

export function iconPrompt(subject: string) {
	return `${ICON_STYLE_PROMPT} Subject: ${subject}.`;
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
