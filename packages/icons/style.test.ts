import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dishPromptInput, iconPrompt } from "./style";

const smashBurger = [
	{ canonicalKey: "ground-beef", form: null },
	{ canonicalKey: "brioche-bun", form: null },
	{ canonicalKey: "cheddar", form: null },
	{ canonicalKey: "onion", form: null },
	{ canonicalKey: "pickle", form: "sliced" },
	{ canonicalKey: "ketchup", form: null },
	{ canonicalKey: "mustard", form: null },
	{ canonicalKey: "butter", form: null },
	{ canonicalKey: "salt", form: null },
	{ canonicalKey: "pepper", form: null },
];

describe("iconPrompt", () => {
	it("names every stored ingredient and forbids anything else", () => {
		const source = dishPromptInput(
			[
				{
					locale: "de",
					title: "Smash-Burger vom Client",
					ingredients: [
						{ canonicalKey: "ground-beef", form: "roh" },
						{ canonicalKey: "lettuce", form: null },
						{ canonicalKey: "tomato", form: "in Scheiben" },
					],
				},
				{
					locale: "en",
					title: "Smash Burger",
					ingredients: smashBurger,
				},
			],
			"Client title",
		);

		assert.ok(source);
		assert.equal(source.title, "Smash Burger");

		const prompt = iconPrompt(source);

		for (const label of [
			"Smash Burger",
			"ground beef",
			"brioche bun",
			"cheddar",
			"onion",
			"pickle (sliced)",
			"ketchup",
			"mustard",
			"butter",
			"salt",
			"pepper",
		]) {
			assert.equal(prompt.includes(label), true, label);
		}

		assert.match(
			prompt,
			/Show only these ingredients; do not add any other ingredients, garnishes, herbs, vegetables, sauces or side dishes that are not listed\. Salt, pepper and oil may be invisible\./,
		);
		assert.match(
			prompt,
			/Plates, cutlery, glasses of water, and napkins are allowed\./,
		);
		assert.match(
			prompt,
			/Do not add extra food side dishes, such as fries, unless they are listed\./,
		);
		assert.equal(prompt.includes("lettuce"), false);
		assert.equal(prompt.includes("tomato"), false);
		assert.equal(prompt.includes("Client title"), false);
	});
});
