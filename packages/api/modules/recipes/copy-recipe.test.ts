import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExtractedRecipe } from "@repo/ai";
import {
	cloneRecipeContent,
	copiedHeroIcon,
	copyRecipeRow,
	copySourceUrl,
	planRecipeSave,
} from "./copy-recipe";

const pasta: ExtractedRecipe = {
	title: "Tomato pasta",
	description: "A simple pasta.",
	image: null,
	servings: 2,
	prepTimeSeconds: 600,
	cookTimeSeconds: 900,
	ingredients: [
		{
			id: "pasta",
			name: "Pasta",
			canonicalKey: "pasta",
			quantity: 200,
			unit: "g",
			form: null,
		},
	],
	steps: [
		{
			id: "boil",
			text: "Boil the pasta for 10 minutes.",
			ingredientIds: ["pasta"],
			timerSeconds: 600,
		},
	],
};

describe("planRecipeSave", () => {
	it("bookmarks a recipe the viewer already owns", () => {
		const owned = planRecipeSave({
			viewerUserId: "user_a",
			recipeUserId: "user_a",
			hasImport: false,
			existingCopyId: null,
			sourceRecipeId: "recipe_1",
		});
		assert.deepEqual(owned, { action: "bookmark", recipeId: "recipe_1" });

		const imported = planRecipeSave({
			viewerUserId: "user_a",
			recipeUserId: null,
			hasImport: true,
			existingCopyId: null,
			sourceRecipeId: "recipe_1",
		});
		assert.deepEqual(imported, {
			action: "bookmark",
			recipeId: "recipe_1",
		});
	});

	it("reuses an existing copy instead of copying again", () => {
		const plan = planRecipeSave({
			viewerUserId: "user_a",
			recipeUserId: null,
			hasImport: false,
			existingCopyId: "copy_1",
			sourceRecipeId: "starter_1",
		});
		assert.deepEqual(plan, { action: "bookmark", recipeId: "copy_1" });
	});

	it("copies a curated or unowned recipe", () => {
		const plan = planRecipeSave({
			viewerUserId: "user_a",
			recipeUserId: null,
			hasImport: false,
			existingCopyId: null,
			sourceRecipeId: "starter_1",
		});
		assert.deepEqual(plan, { action: "copy" });
	});
});

describe("copyRecipeRow", () => {
	it("stores the source id and does not mark the copy curated", () => {
		const raw = { html: "<p>original</p>" };
		const row = copyRecipeRow({
			userId: "user_a",
			sourceRecipeId: "starter_1",
			rawData: raw,
		});

		assert.equal(row.sourceRecipeId, "starter_1");
		assert.equal(row.userId, "user_a");
		assert.equal(row.isCurated, false);
		assert.equal(row.source, "copy");
		assert.equal(row.sourceUrl, copySourceUrl("user_a", "starter_1"));
		raw.html = "changed";
		assert.equal(row.rawData.html, "<p>original</p>");
	});

	it("gives each user a distinct copy address", () => {
		assert.notEqual(
			copySourceUrl("user_a", "starter_1"),
			copySourceUrl("user_b", "starter_1"),
		);
	});
});

describe("cloneRecipeContent", () => {
	it("copies ingredients and steps without sharing the object", () => {
		const copy = cloneRecipeContent(pasta);
		const ingredient = copy.ingredients[0];
		const step = copy.steps[0];
		assert.ok(ingredient);
		assert.ok(step);
		ingredient.name = "Noodles";
		step.text = "Changed.";
		assert.equal(pasta.ingredients[0]?.name, "Pasta");
		assert.equal(pasta.steps[0]?.text, "Boil the pasta for 10 minutes.");
	});
});

describe("copiedHeroIcon", () => {
	it("reuses the ready photo and does not describe a new generation", () => {
		const icon = copiedHeroIcon({
			copyRecipeId: "copy_1",
			source: {
				storageUrl: "https://storage.example/icons/recipe/starter.webp",
				prompt: "finished pasta",
				model: "google/gemini-3.1-flash-image-preview",
				status: "ready",
			},
		});

		assert.equal(
			icon?.storageUrl,
			"https://storage.example/icons/recipe/starter.webp",
		);
		assert.equal(icon?.key, "copy_1");
		assert.equal(icon?.recipeId, "copy_1");
		assert.equal(icon?.status, "ready");
		assert.equal("generate" in (icon ?? {}), false);
	});

	it("skips a photo that is not ready", () => {
		assert.equal(
			copiedHeroIcon({
				copyRecipeId: "copy_1",
				source: {
					storageUrl: null,
					prompt: "finished pasta",
					model: "mock",
					status: "pending",
				},
			}),
			null,
		);
	});
});
