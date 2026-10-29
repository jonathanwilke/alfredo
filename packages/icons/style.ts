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

/**
 * Visual forms that get their own ingredient icon.
 * Canonical keys are English kebab-case: `<base>` or `<base>-<form>`.
 * Add a suffix only when the form changes the picture
 * (`black-pepper-ground` vs `black-pepper-whole`, `basil-fresh` vs `basil-dried`).
 * Leave it off when the picture would be the same (`onion`, `egg`, `butter`).
 * Slicing, chopping, and cooking are preparations, not icon forms.
 * Keep this list in sync with `CANONICAL_KEY_FORMS` in `@repo/ai`.
 */
export const INGREDIENT_FORMS = [
	"ground",
	"whole",
	"fresh",
	"dried",
	"flakes",
	"powder",
	"smoked",
] as const;

export type IngredientForm = (typeof INGREDIENT_FORMS)[number];

/**
 * Obvious synonyms that must share one icon.
 * Targets are already canonical and are not aliases themselves.
 */
export const INGREDIENT_KEY_ALIASES: Readonly<Record<string, string>> = {
	pepper: "black-pepper-ground",
	"black-pepper": "black-pepper-ground",
	"ground-pepper": "black-pepper-ground",
	"ground-black-pepper": "black-pepper-ground",
	peppercorn: "black-pepper-whole",
	peppercorns: "black-pepper-whole",
	"black-peppercorn": "black-pepper-whole",
	"black-peppercorns": "black-pepper-whole",
	"whole-pepper": "black-pepper-whole",
	"whole-black-pepper": "black-pepper-whole",
};

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

/** Plain words for the icon prompt: "black pepper, ground" or "olive oil". */
export function ingredientSubject(key: string) {
	const canonical = normalizeIngredientKey(key);
	const form = INGREDIENT_FORMS.find((item) =>
		canonical.endsWith(`-${item}`),
	);
	if (!form) {
		return canonical.replaceAll("-", " ");
	}

	const base = canonical.slice(0, -(form.length + 1));
	return `${base.replaceAll("-", " ")}, ${form}`;
}

export function buildIngredientPrompt(key: string, promptExtra?: string) {
	const prompt = ingredientIconPrompt(ingredientSubject(key));
	const extra = promptExtra?.trim();
	return extra ? `${prompt} ${extra}` : prompt;
}

/**
 * Ingredient objects are one file per canonical key.
 * Recipe photos stay timestamped so this change does not rewrite them.
 */
export function iconObjectKey(
	kind: "ingredient" | "recipe",
	key: string,
	now = Date.now(),
) {
	if (kind === "recipe") {
		return `recipe/${key}-${now}.webp`;
	}

	return `ingredient/${key}.webp`;
}

/** First successful write keeps the row version. Later overwrites bump it. */
export function nextIngredientVersion(row: {
	storageUrl: string | null;
	version: number;
}) {
	return row.storageUrl ? row.version + 1 : row.version;
}

/** Cache-bust ingredient URLs. Recipe photo URLs are returned unchanged. */
export function publicIconUrl(
	storageUrl: string | null,
	version: number,
	kind: "ingredient" | "recipe",
) {
	if (!storageUrl || kind !== "ingredient") {
		return storageUrl;
	}

	const hashIndex = storageUrl.indexOf("#");
	const hash = hashIndex === -1 ? "" : storageUrl.slice(hashIndex);
	const withoutHash =
		hashIndex === -1 ? storageUrl : storageUrl.slice(0, hashIndex);
	const queryIndex = withoutHash.indexOf("?");
	const base =
		queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
	const params = new URLSearchParams(
		queryIndex === -1 ? "" : withoutHash.slice(queryIndex + 1),
	);
	params.set("v", String(version));
	return `${base}?${params.toString()}${hash}`;
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

	return INGREDIENT_KEY_ALIASES[key] ?? key;
}
