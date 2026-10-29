import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
	buildIngredientPrompt,
	INGREDIENT_FORMS,
	INGREDIENT_KEY_ALIASES,
	iconObjectKey,
	ingredientSubject,
	nextIngredientVersion,
	normalizeIngredientKey,
	publicIconUrl,
} from "./style";

describe("ingredient icon keys", () => {
	it("stores one ingredient object and leaves recipe photos timestamped", () => {
		const now = 1_700_000_000_000;
		assert.equal(
			iconObjectKey("ingredient", "black-pepper-ground", now),
			"ingredient/black-pepper-ground.webp",
		);
		assert.equal(
			iconObjectKey("ingredient", "black-pepper-ground", now + 50),
			"ingredient/black-pepper-ground.webp",
		);
		assert.equal(
			iconObjectKey("recipe", "recipe-id", now),
			`recipe/recipe-id-${now}.webp`,
		);
		assert.notEqual(
			iconObjectKey("recipe", "recipe-id", now),
			iconObjectKey("recipe", "recipe-id", now + 1),
		);
	});

	it("bumps the version only after an ingredient object already exists", () => {
		assert.equal(
			nextIngredientVersion({ storageUrl: null, version: 1 }),
			1,
		);
		assert.equal(
			nextIngredientVersion({
				storageUrl: "https://cdn.example/ingredient/onion.webp",
				version: 1,
			}),
			2,
		);
	});

	it("cache-busts ingredient urls and leaves dish photo urls unchanged", () => {
		const dish = "https://cdn.example/recipe/dish-170.webp";
		assert.equal(publicIconUrl(dish, 4, "recipe"), dish);
		assert.equal(publicIconUrl(null, 2, "ingredient"), null);
		assert.equal(
			publicIconUrl(
				"https://cdn.example/ingredient/onion.webp",
				2,
				"ingredient",
			),
			"https://cdn.example/ingredient/onion.webp?v=2",
		);
	});

	it("collapses pepper aliases and keeps whole pepper separate", () => {
		assert.equal(normalizeIngredientKey("pepper"), "black-pepper-ground");
		assert.equal(normalizeIngredientKey("Pepper"), "black-pepper-ground");
		assert.equal(
			normalizeIngredientKey("black pepper"),
			"black-pepper-ground",
		);
		assert.equal(
			normalizeIngredientKey("black-pepper-ground"),
			"black-pepper-ground",
		);
		assert.equal(
			normalizeIngredientKey("black-pepper-whole"),
			"black-pepper-whole",
		);
		assert.equal(
			normalizeIngredientKey("peppercorns"),
			"black-pepper-whole",
		);
		assert.notEqual(
			normalizeIngredientKey("pepper"),
			normalizeIngredientKey("black-pepper-whole"),
		);

		for (const target of Object.values(INGREDIENT_KEY_ALIASES)) {
			assert.equal(normalizeIngredientKey(target), target);
		}
	});

	it("names the icon subject with base and form", () => {
		assert.equal(ingredientSubject("pepper"), "black pepper, ground");
		assert.equal(
			ingredientSubject("black-pepper-whole"),
			"black pepper, whole",
		);
		assert.equal(ingredientSubject("olive-oil"), "olive oil");
		assert.match(
			buildIngredientPrompt("black-pepper-ground"),
			/Subject: raw black pepper, ground\./,
		);
		assert.match(
			buildIngredientPrompt("black-pepper-whole", "extra basil leaf"),
			/Subject: raw black pepper, whole\..*extra basil leaf/,
		);
	});

	it("keeps the extraction form list aligned and out of jobs timestamps", () => {
		const ai = readFileSync(
			new URL("../ai/index.ts", import.meta.url),
			"utf8",
		);
		const formsBlock = ai.slice(
			ai.indexOf("export const CANONICAL_KEY_FORMS"),
			ai.indexOf("export const CANONICAL_KEY_INSTRUCTION"),
		);
		const instructionBlock = ai.slice(
			ai.indexOf("export const CANONICAL_KEY_INSTRUCTION"),
			ai.indexOf("export const ingredientSchema"),
		);
		const forms = [...formsBlock.matchAll(/"([a-z]+)"/g)].map(
			(match) => match[1],
		);
		assert.deepEqual(forms, [...INGREDIENT_FORMS]);
		for (const form of INGREDIENT_FORMS) {
			assert.match(instructionBlock, new RegExp(`\\b${form}\\b`));
		}
		assert.match(instructionBlock, /black-pepper-ground/);
		assert.match(instructionBlock, /black-pepper-whole/);
		assert.match(instructionBlock, /slicing/);
		assert.match(ai, /CANONICAL_KEY_INSTRUCTION/);

		const jobs = readFileSync(
			new URL("./jobs.ts", import.meta.url),
			"utf8",
		);
		assert.equal(jobs.includes("Date.now"), false);
		assert.equal(jobs.includes("@repo/payments"), false);
		assert.match(jobs, /iconObjectKey\(row\.kind, row\.key\)/);
	});
});
