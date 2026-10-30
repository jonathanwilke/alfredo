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
	it("names every stored ingredient and allows only a light garnish", () => {
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

		const ingredientsLine = prompt.slice(
			prompt.indexOf("Ingredients:"),
			prompt.indexOf("Light decorative garnish"),
		);
		assert.equal(ingredientsLine.includes("lettuce"), false);
		assert.equal(ingredientsLine.includes("tomato"), false);
		assert.match(
			prompt,
			/Light decorative garnish that suits the dish is allowed even when it is not listed, such as a few berries, a mint leaf, a dollop of whipped cream, a dusting of powdered sugar on pancakes or crêpes, or fresh herbs sprinkled on top\./,
		);
		assert.match(
			prompt,
			/Do not add extra main ingredients, vegetables, sauces, or toppings inside the dish that are not listed and that would change what the dish is, such as lettuce or tomato on a burger\./,
		);
		assert.match(
			prompt,
			/Do not add side dishes, such as fries, unless they are listed\./,
		);
		assert.match(prompt, /Salt, pepper and oil may be invisible\./);
		assert.match(
			prompt,
			/Plates, cutlery, glasses of water, and napkins are allowed\./,
		);
		assert.equal(prompt.includes("Client title"), false);
	});
});
