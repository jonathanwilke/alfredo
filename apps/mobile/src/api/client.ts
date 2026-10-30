import { z } from "zod";
import {
	balanceSchema,
	type CreditBalance,
	type CreditEntry,
	historyEntrySchema,
	iconSchema,
	type Locale,
	type RecipeIcon,
	type StarterRecipe,
	type StoredRecipe,
	starterSchema,
	storedRecipeSchema,
} from "@/api/types";
import { authClient } from "@/auth/client";
import { siteOrigin } from "@/auth/origin";

const apiBase = `${siteOrigin}/api`;

export class ApiError extends Error {
	readonly status: number;
	readonly code: string;
	readonly data: unknown;

	constructor(message: string, status: number, code: string, data?: unknown) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
		this.data = data;
	}
}

export function apiCode(error: unknown) {
	return error instanceof ApiError ? error.code : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value === "object" && value !== null) {
		return value as Record<string, unknown>;
	}
	return null;
}

async function readError(response: Response) {
	let code = response.status === 401 ? "UNAUTHORIZED" : "UNKNOWN";
	let message = response.statusText || "request_failed";
	let data: unknown;
	try {
		const body = await response.json();
		const record = asRecord(body);
		const payload = asRecord(record?.json) ?? record;
		if (payload) {
			if (typeof payload.code === "string") {
				code = payload.code;
			}
			if (typeof payload.message === "string" && payload.message) {
				message = payload.message;
			}
			if ("data" in payload) {
				data = payload.data;
			}
		}
	} catch {
		// The body was not JSON.
	}
	return new ApiError(message, response.status, code, data);
}

async function request(path: string, init?: RequestInit) {
	const headers = new Headers(init?.headers);
	headers.set("Accept", "application/json");
	if (init?.body) {
		headers.set("Content-Type", "application/json");
	}
	const cookie = await authClient.getCookie();
	if (cookie) {
		headers.set("Cookie", cookie);
	}
	let response: Response;
	try {
		response = await fetch(`${apiBase}${path}`, {
			...init,
			headers,
			credentials: "omit",
		});
	} catch (error) {
		throw new ApiError(
			error instanceof Error ? error.message : "network",
			0,
			"NETWORK",
		);
	}
	if (!response.ok) {
		throw await readError(response);
	}
	if (response.status === 204) {
		return null;
	}
	return response.json();
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
	const result = schema.safeParse(value);
	if (!result.success) {
		throw new ApiError("invalid_response", 200, "INVALID_RESPONSE");
	}
	return result.data;
}

function query(path: string, params: Record<string, string>) {
	const search = new URLSearchParams(params);
	return `${path}?${search.toString()}`;
}

export const api = {
	async starters(locale: Locale): Promise<StarterRecipe[]> {
		const json = await request(query("/recipes/starters", { locale }));
		return parse(z.array(starterSchema), json);
	},
	async recipe(
		recipeId: string,
		locale: Locale,
	): Promise<StoredRecipe | null> {
		const json = await request(
			query(`/recipes/${encodeURIComponent(recipeId)}`, { locale }),
		);
		if (json == null) {
			return null;
		}
		return parse(storedRecipeSchema, json);
	},
	async importRecipe(url: string, locale: Locale): Promise<StoredRecipe> {
		const json = await request("/recipes/import", {
			method: "POST",
			body: JSON.stringify({ url, locale }),
		});
		return parse(storedRecipeSchema, json);
	},
	async recipeSaved(recipeId: string): Promise<boolean> {
		const json = await request(
			`/recipes/${encodeURIComponent(recipeId)}/saved`,
		);
		return parse(z.object({ saved: z.boolean() }), json).saved;
	},
	async saveRecipe(recipeId: string) {
		const json = await request(
			`/recipes/${encodeURIComponent(recipeId)}/save`,
			{
				method: "POST",
				body: JSON.stringify({ recipeId }),
			},
		);
		return parse(
			z.object({ saved: z.literal(true), recipeId: z.string().uuid() }),
			json,
		);
	},
	async unsaveRecipe(recipeId: string) {
		await request(`/recipes/${encodeURIComponent(recipeId)}/save`, {
			method: "DELETE",
		});
	},
	async savedRecipes(locale: Locale) {
		const json = await request(query("/recipes/saved", { locale }));
		return parse(
			z.array(z.object({ recipeId: z.string(), title: z.string() })),
			json,
		);
	},
	async enableShare(recipeId: string, locale: Locale) {
		const json = await request(
			`/recipes/${encodeURIComponent(recipeId)}/share`,
			{
				method: "POST",
				body: JSON.stringify({ recipeId, locale }),
			},
		);
		return parse(
			z.object({
				shared: z.boolean(),
				path: z.string().nullable(),
			}),
			json,
		);
	},
	async disableShare(recipeId: string) {
		await request(`/recipes/${encodeURIComponent(recipeId)}/share`, {
			method: "DELETE",
		});
	},
	async icons(recipeId: string): Promise<{
		recipe: RecipeIcon | null;
		ingredients: RecipeIcon[];
	}> {
		const json = await request(query("/icons", { recipeId }));
		return parse(
			z.object({
				recipe: iconSchema.nullable(),
				ingredients: z.array(iconSchema),
			}),
			json,
		);
	},
	async balance(): Promise<CreditBalance> {
		const json = await request("/billing/balance");
		return parse(balanceSchema, json);
	},
	async history(): Promise<CreditEntry[]> {
		const json = await request("/billing/history");
		return parse(z.object({ entries: z.array(historyEntrySchema) }), json)
			.entries;
	},
};
