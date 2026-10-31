import { getBaseUrl } from "@repo/config";
import type { StoredRecipe } from "../recipes/import-recipe";
import {
	importRecipeFromText,
	importRecipeFromUrl,
} from "../recipes/import-recipe";
import {
	importFailureMessage,
	type McpLocale,
	mcpLocale,
	mcpMessages,
} from "./messages";
import { getReadableRecipe, listReadableRecipes } from "./read";
import {
	decodeRecipeCursor,
	recipeIdFromReference,
	recipeLinks,
} from "./reference";

export type ToolResult =
	| { ok: true; data: unknown }
	| { ok: false; message: string };

export type McpToolDeps = {
	importFromUrl: (input: {
		url: string;
		locale: string;
		userId: string;
	}) => Promise<StoredRecipe>;
	importFromText: (input: {
		text: string;
		locale: string;
		userId: string;
	}) => Promise<StoredRecipe>;
	list: typeof listReadableRecipes;
	get: typeof getReadableRecipe;
	baseUrl: string;
};

export function defaultMcpToolDeps(): McpToolDeps {
	return {
		importFromUrl: (input) =>
			importRecipeFromUrl({
				url: input.url,
				locale: input.locale,
				userId: input.userId,
				headers: new Headers(),
			}),
		importFromText: importRecipeFromText,
		list: listReadableRecipes,
		get: getReadableRecipe,
		baseUrl: getBaseUrl(),
	};
}

function createdRecipe(recipe: StoredRecipe, baseUrl: string) {
	return {
		id: recipe.recipeId,
		title: recipe.content.title,
		...recipeLinks(baseUrl, recipe.servedLocale, recipe.recipeId),
	};
}

export function resolveToolLocale(
	requested: string | undefined,
	acceptLanguage: string | null,
): McpLocale {
	return mcpLocale(requested, mcpLocale(acceptLanguage));
}

export async function createRecipeFromLink(
	input: { url: string; locale?: string },
	context: { userId: string; locale: McpLocale },
	deps: McpToolDeps = defaultMcpToolDeps(),
): Promise<ToolResult> {
	const messages = mcpMessages(context.locale);
	let url: URL;
	try {
		url = new URL(input.url.trim());
	} catch {
		return { ok: false, message: messages.invalidUrl };
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return { ok: false, message: messages.invalidUrl };
	}
	const locale = mcpLocale(input.locale, context.locale);
	try {
		const recipe = await deps.importFromUrl({
			url: url.href,
			locale,
			userId: context.userId,
		});
		return { ok: true, data: createdRecipe(recipe, deps.baseUrl) };
	} catch (error) {
		return {
			ok: false,
			message: importFailureMessage(locale, error),
		};
	}
}

export async function createRecipeFromText(
	input: { text: string; locale?: string },
	context: { userId: string; locale: McpLocale },
	deps: McpToolDeps = defaultMcpToolDeps(),
): Promise<ToolResult> {
	const locale = mcpLocale(input.locale, context.locale);
	const messages = mcpMessages(locale);
	if (input.text.trim().length < 12) {
		return { ok: false, message: messages.textTooShort };
	}
	try {
		const recipe = await deps.importFromText({
			text: input.text,
			locale,
			userId: context.userId,
		});
		return { ok: true, data: createdRecipe(recipe, deps.baseUrl) };
	} catch (error) {
		return {
			ok: false,
			message: importFailureMessage(locale, error),
		};
	}
}

export async function listRecipes(
	input: {
		query?: string;
		limit?: number;
		cursor?: string;
		locale?: string;
	},
	context: { userId: string; locale: McpLocale },
	deps: McpToolDeps = defaultMcpToolDeps(),
): Promise<ToolResult> {
	const locale = mcpLocale(input.locale, context.locale);
	const messages = mcpMessages(locale);
	if (input.cursor && !decodeRecipeCursor(input.cursor)) {
		return { ok: false, message: messages.invalidCursor };
	}
	try {
		const page = await deps.list({
			userId: context.userId,
			locale,
			query: input.query,
			limit: input.limit ?? 20,
			cursor: input.cursor,
			baseUrl: deps.baseUrl,
		});
		return {
			ok: true,
			data: {
				recipes: page.recipes,
				nextCursor: page.nextCursor,
			},
		};
	} catch (error) {
		if (error instanceof Error && error.message === "invalid_cursor") {
			return { ok: false, message: messages.invalidCursor };
		}
		return { ok: false, message: messages.extract_failed };
	}
}

export async function getRecipe(
	input: { recipe: string; locale?: string },
	context: { userId: string; locale: McpLocale },
	deps: McpToolDeps = defaultMcpToolDeps(),
): Promise<ToolResult> {
	const locale = mcpLocale(input.locale, context.locale);
	const messages = mcpMessages(locale);
	const recipeId = recipeIdFromReference(input.recipe, deps.baseUrl);
	if (!recipeId) {
		return { ok: false, message: messages.invalidRecipe };
	}
	const recipe = await deps.get({
		userId: context.userId,
		recipeId,
		locale,
		baseUrl: deps.baseUrl,
	});
	if (!recipe) {
		return { ok: false, message: messages.notFound };
	}
	return { ok: true, data: recipe };
}

export const toolDescriptions = {
	create_recipe_from_link:
		"Import a recipe into the signed-in user's ulivo account from a recipe website or a video URL such as YouTube, TikTok, or Instagram. Pass the full http or https URL. A new import costs one credit. A recipe already stored for this language is free. Returns the recipe id, title, ulivo URL, and cooking-mode URL.",
	create_recipe_from_text:
		"Create an interactive ulivo recipe when the user asks to save or create a recipe in ulivo and the recipe is already in the conversation, not a link. Pass the full recipe text as markdown or plain text, including the title, every ingredient with its amount, and every step. Do not summarize or drop ingredients or steps. Optional servings and language may be in the text. Set locale to de or en to match the user. A new recipe costs one credit, the same as a new link import. The same text for the same user and language is free the second time. Returns the recipe id, title, ulivo URL, and cooking-mode URL.",
	list_recipes:
		"List the signed-in user's own and saved ulivo recipes, plus public starter recipes flagged with curated true. Optionally search by title. Use limit and the returned nextCursor to page.",
	get_recipe:
		"Read one recipe the signed-in user can open: their own recipe, a saved recipe, or a public starter. Pass a ulivo recipe id or an ulivo.app recipe URL. Returns the full structured recipe, including ingredients with amounts, steps with the ingredients and timers used in each step, the source URL when it is a web link, and the ulivo and cooking-mode URLs.",
} as const;
