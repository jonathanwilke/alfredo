import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExtractedRecipe } from "@repo/ai";
import { InsufficientCreditsError } from "@repo/payments";
import type { StoredRecipe } from "../recipes/import-recipe";
import { ImportError } from "../recipes/source";
import { textRecipeSourceUrl } from "../recipes/text-source";
import {
	canReadMcpRecipe,
	decodeRecipeCursor,
	encodeRecipeCursor,
	formatMcpRecipe,
	recipeIdFromReference,
} from "./reference";
import {
	createRecipeFromLink,
	createRecipeFromText,
	getRecipe,
	listRecipes,
	type McpToolDeps,
} from "./tools";

const recipeId = "11111111-1111-4111-8111-111111111111";
const baseUrl = "https://ulivo.app";

const content: ExtractedRecipe = {
	title: "Pasta",
	description: "A bowl of pasta.",
	image: null,
	servings: 2,
	prepTimeSeconds: null,
	cookTimeSeconds: 600,
	ingredients: [
		{
			id: "i1",
			name: "Pasta",
			canonicalKey: "pasta",
			quantity: 200,
			unit: "g",
			form: null,
		},
	],
	steps: [
		{
			id: "s1",
			text: "Boil for 10 minutes.",
			ingredientIds: ["i1"],
			timerSeconds: 600,
		},
	],
};

function stored(overrides: Partial<StoredRecipe> = {}): StoredRecipe {
	return {
		recipeId,
		sourceUrl: "https://example.com/pasta",
		isCurated: false,
		servedLocale: "en",
		content,
		...overrides,
	};
}

function deps(overrides: Partial<McpToolDeps> = {}): McpToolDeps {
	return {
		importFromUrl: async () => stored(),
		importFromText: async () => stored(),
		list: async () => ({ recipes: [], nextCursor: null }),
		get: async () => null,
		baseUrl,
		...overrides,
	};
}

const user = { userId: "user_a", locale: "en" as const };

describe("createRecipeFromLink", () => {
	it("returns the ulivo recipe and cooking urls", async () => {
		const result = await createRecipeFromLink(
			{ url: "https://example.com/pasta" },
			user,
			deps(),
		);
		assert.equal(result.ok, true);
		if (!result.ok) {
			return;
		}
		assert.deepEqual(result.data, {
			id: recipeId,
			title: "Pasta",
			url: `https://ulivo.app/recipes/${recipeId}`,
			cookingUrl: `https://ulivo.app/recipes/${recipeId}?cook=1`,
		});
	});

	it("uses the same credit error as an import", async () => {
		const result = await createRecipeFromLink(
			{ url: "https://example.com/pasta" },
			{ userId: "user_a", locale: "de" },
			deps({
				importFromUrl: async () => {
					throw new InsufficientCreditsError(0);
				},
			}),
		);
		assert.deepEqual(result, {
			ok: false,
			message: "Dafür brauchst du 1 Guthaben. Du hast noch 0.",
		});
	});

	it("rejects a link that is not http", async () => {
		let called = false;
		const result = await createRecipeFromLink(
			{ url: "ftp://example.com/pasta" },
			user,
			deps({
				importFromUrl: async () => {
					called = true;
					return stored();
				},
			}),
		);
		assert.equal(called, false);
		assert.equal(result.ok, false);
	});
});

describe("createRecipeFromText", () => {
	it("sends the full recipe text through the import pipeline", async () => {
		let seen = "";
		const text = "Tomato soup\n\n2 tomatoes\n\nSimmer for 20 minutes.";
		const result = await createRecipeFromText(
			{ text, locale: "de" },
			user,
			deps({
				importFromText: async (input) => {
					seen = input.text;
					assert.equal(input.locale, "de");
					assert.equal(input.userId, "user_a");
					return stored({ servedLocale: "de" });
				},
			}),
		);
		assert.equal(seen, text);
		assert.equal(result.ok, true);
		if (result.ok) {
			assert.equal(
				(result.data as { url: string }).url,
				`https://ulivo.app/de/recipes/${recipeId}`,
			);
		}
	});

	it("asks for the full recipe before charging", async () => {
		let called = false;
		const result = await createRecipeFromText(
			{ text: "soup" },
			user,
			deps({
				importFromText: async () => {
					called = true;
					return stored();
				},
			}),
		);
		assert.equal(called, false);
		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.match(result.message, /full recipe/i);
		}
	});

	it("maps a failed extraction", async () => {
		const result = await createRecipeFromText(
			{
				text: "Not a recipe, just a long paragraph about the weather today.",
			},
			user,
			deps({
				importFromText: async () => {
					throw new ImportError("not_a_recipe");
				},
			}),
		);
		assert.deepEqual(result, {
			ok: false,
			message: "That does not look like a recipe.",
		});
	});
});

describe("listRecipes and getRecipe", () => {
	it("pages the caller's recipes", async () => {
		const seen: { query?: string; limit?: number } = {};
		const result = await listRecipes(
			{ query: "pasta", limit: 5 },
			user,
			deps({
				list: async (input) => {
					seen.query = input.query;
					seen.limit = input.limit;
					return {
						recipes: [
							{
								id: recipeId,
								title: "Pasta",
								description: "A bowl of pasta.",
								imageUrl: null,
								url: `https://ulivo.app/recipes/${recipeId}`,
								curated: false,
							},
						],
						nextCursor: null,
					};
				},
			}),
		);
		assert.equal(seen?.query, "pasta");
		assert.equal(seen?.limit, 5);
		assert.equal(result.ok, true);
	});

	it("rejects a broken cursor before reading", async () => {
		let called = false;
		const result = await listRecipes(
			{ cursor: "nope" },
			user,
			deps({
				list: async () => {
					called = true;
					return { recipes: [], nextCursor: null };
				},
			}),
		);
		assert.equal(called, false);
		assert.equal(result.ok, false);
	});

	it("reads a recipe from an ulivo URL and hides another account", async () => {
		const formatted = formatMcpRecipe({
			id: recipeId,
			locale: "en",
			curated: true,
			sourceUrl: "text:user_a:abc",
			content,
			imageUrl: null,
			baseUrl,
		});
		const found = await getRecipe(
			{ recipe: `https://ulivo.app/recipes/${recipeId}?cook=1` },
			user,
			deps({
				get: async () => formatted,
			}),
		);
		assert.equal(found.ok, true);
		if (found.ok) {
			const recipe = found.data as typeof formatted;
			assert.equal(recipe.sourceUrl, null);
			assert.equal(recipe.steps[0]?.timerSeconds, 600);
			assert.equal(recipe.steps[0]?.ingredients[0]?.name, "Pasta");
			assert.equal(recipe.curated, true);
		}

		const missing = await getRecipe(
			{ recipe: recipeId },
			user,
			deps({ get: async () => null }),
		);
		assert.deepEqual(missing, {
			ok: false,
			message: "That recipe is not on this account.",
		});

		const foreign = await getRecipe(
			{ recipe: `https://evil.example/recipes/${recipeId}` },
			user,
			deps(),
		);
		assert.equal(foreign.ok, false);
	});
});

describe("recipe references", () => {
	it("keeps private recipes off the tool and accepts ulivo urls", () => {
		assert.equal(
			canReadMcpRecipe({
				isCurated: false,
				owns: false,
				saved: false,
			}),
			false,
		);
		assert.equal(
			canReadMcpRecipe({
				isCurated: true,
				owns: false,
				saved: false,
			}),
			true,
		);
		assert.equal(
			canReadMcpRecipe({ isCurated: false, owns: false, saved: true }),
			true,
		);
		assert.equal(recipeIdFromReference(recipeId, baseUrl), recipeId);
		assert.equal(
			recipeIdFromReference(
				`https://www.ulivo.app/de/recipes/${recipeId}`,
				baseUrl,
			),
			recipeId,
		);
		assert.equal(
			recipeIdFromReference(`https://example.com/recipes/${recipeId}`),
			null,
		);
	});

	it("round-trips a page cursor and keys text imports per user", () => {
		const cursor = encodeRecipeCursor({
			createdAt: "2026-01-02T03:04:05.000Z",
			id: recipeId,
		});
		assert.deepEqual(decodeRecipeCursor(cursor), {
			createdAt: "2026-01-02T03:04:05.000Z",
			id: recipeId,
		});
		assert.equal(decodeRecipeCursor("%%%"), null);
		const text = "Soup\n\n1 onion\n\nSimmer.";
		const first = textRecipeSourceUrl("user_a", "en", text);
		assert.equal(textRecipeSourceUrl("user_a", "en", `  ${text}  `), first);
		assert.notEqual(textRecipeSourceUrl("user_b", "en", text), first);
		assert.notEqual(textRecipeSourceUrl("user_a", "de", text), first);
	});
});
