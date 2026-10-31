import type { ExtractedRecipe } from "@repo/ai";
import { getBaseUrl } from "@repo/config";
import { z } from "zod";
import { publicRecipePath } from "../recipes/access";

const recipeIdSchema = z.string().uuid();

export type RecipeCursor = {
	createdAt: string;
	id: string;
};

export function encodeRecipeCursor(input: RecipeCursor) {
	return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

export function decodeRecipeCursor(value: string): RecipeCursor | null {
	try {
		const parsed = JSON.parse(
			Buffer.from(value, "base64url").toString("utf8"),
		) as { createdAt?: unknown; id?: unknown };
		if (
			typeof parsed.createdAt !== "string" ||
			typeof parsed.id !== "string" ||
			!recipeIdSchema.safeParse(parsed.id).success ||
			Number.isNaN(Date.parse(parsed.createdAt))
		) {
			return null;
		}
		return {
			createdAt: new Date(parsed.createdAt).toISOString(),
			id: parsed.id,
		};
	} catch {
		return null;
	}
}

export function canReadMcpRecipe(input: {
	isCurated: boolean;
	owns: boolean;
	saved: boolean;
}) {
	return input.isCurated || input.owns || input.saved;
}

function allowedRecipeHost(hostname: string, baseUrl: string) {
	const host = hostname.toLowerCase().replace(/\.$/, "");
	if (host === "ulivo.app" || host === "www.ulivo.app") {
		return true;
	}
	try {
		return new URL(baseUrl).hostname.toLowerCase() === host;
	} catch {
		return false;
	}
}

/** Recipe id from a bare id or an ulivo recipe URL, including `?cook=1`. */
export function recipeIdFromReference(value: string, baseUrl = getBaseUrl()) {
	const trimmed = value.trim();
	if (recipeIdSchema.safeParse(trimmed).success) {
		return trimmed;
	}
	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return null;
	}
	if (!allowedRecipeHost(url.hostname, baseUrl)) {
		return null;
	}
	const match = url.pathname.match(
		/\/recipes\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i,
	);
	return match?.[1] ?? null;
}

export function recipeLinks(baseUrl: string, locale: string, recipeId: string) {
	const url = `${baseUrl.replace(/\/$/, "")}${publicRecipePath(locale, recipeId)}`;
	return { url, cookingUrl: `${url}?cook=1` };
}

export function httpUrl(value: string | null | undefined) {
	const trimmed = value?.trim();
	if (!trimmed) {
		return null;
	}
	try {
		const url = new URL(trimmed);
		if (url.protocol === "http:" || url.protocol === "https:") {
			return url.href;
		}
	} catch {
		return null;
	}
	return null;
}

export type McpIngredient = {
	id: string;
	name: string;
	quantity: number | null;
	unit: string | null;
	form: string | null;
};

export type McpRecipe = {
	id: string;
	title: string;
	description: string | null;
	servings: number;
	ingredients: McpIngredient[];
	steps: {
		id: string;
		text: string;
		timerSeconds: number | null;
		ingredients: McpIngredient[];
	}[];
	sourceUrl: string | null;
	imageUrl: string | null;
	url: string;
	cookingUrl: string;
	curated: boolean;
	locale: string;
};

export function formatMcpRecipe(input: {
	id: string;
	locale: string;
	curated: boolean;
	sourceUrl: string;
	content: ExtractedRecipe;
	imageUrl: string | null;
	baseUrl: string;
}): McpRecipe {
	const ingredients: McpIngredient[] = input.content.ingredients.map(
		(ingredient) => ({
			id: ingredient.id,
			name: ingredient.name,
			quantity: ingredient.quantity,
			unit: ingredient.unit,
			form: ingredient.form?.trim() || null,
		}),
	);
	const byId = new Map(
		ingredients.map((ingredient) => [ingredient.id, ingredient]),
	);
	const links = recipeLinks(input.baseUrl, input.locale, input.id);
	return {
		id: input.id,
		title: input.content.title,
		description: input.content.description?.trim() || null,
		servings: input.content.servings > 0 ? input.content.servings : 1,
		ingredients,
		steps: input.content.steps.map((step) => ({
			id: step.id,
			text: step.text,
			timerSeconds: step.timerSeconds,
			ingredients: step.ingredientIds.flatMap((id) => {
				const ingredient = byId.get(id);
				return ingredient ? [ingredient] : [];
			}),
		})),
		sourceUrl: httpUrl(input.sourceUrl),
		imageUrl: httpUrl(input.imageUrl) ?? httpUrl(input.content.image),
		url: links.url,
		cookingUrl: links.cookingUrl,
		curated: input.curated,
		locale: input.locale,
	};
}
