import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyStepIngredients,
	resolveStepUses,
	type StepIngredientInput,
	stepIngredientLine,
} from "./step-ingredients";

const carbonara = [
	{
		id: "spaghetti",
		name: "Spaghetti",
		canonicalKey: "spaghetti",
		quantity: 200,
		unit: "g",
	},
	{
		id: "guanciale",
		name: "Guanciale",
		canonicalKey: "guanciale",
		quantity: 80,
		unit: "g",
	},
	{
		id: "egg",
		name: "Eier",
		canonicalKey: "egg",
		quantity: 2,
		unit: null,
	},
	{
		id: "yolk",
		name: "Eigelb",
		canonicalKey: "egg-yolk",
		quantity: 2,
		unit: null,
	},
	{
		id: "pecorino",
		name: "Pecorino",
		canonicalKey: "pecorino",
		quantity: 50,
		unit: "g",
	},
	{
		id: "pepper",
		name: "schwarzer Pfeffer",
		canonicalKey: "black-pepper",
		quantity: null,
		unit: null,
	},
	{
		id: "salt",
		name: "Salz",
		canonicalKey: "salt",
		quantity: null,
		unit: null,
	},
];

const burger = [
	{
		id: "beef",
		name: "Ground beef",
		canonicalKey: "ground-beef",
		quantity: 400,
		unit: "g",
	},
	{
		id: "bun",
		name: "Burger buns",
		canonicalKey: "burger-bun",
		quantity: 4,
		unit: null,
	},
	{
		id: "cheddar",
		name: "Cheddar",
		canonicalKey: "cheddar",
		quantity: 4,
		unit: null,
	},
	{
		id: "onion",
		name: "Onion",
		canonicalKey: "onion",
		quantity: 1,
		unit: null,
	},
	{
		id: "pickle",
		name: "Pickles",
		canonicalKey: "pickle",
		quantity: 4,
		unit: null,
	},
	{
		id: "butter",
		name: "Butter",
		canonicalKey: "butter",
		quantity: 20,
		unit: "g",
	},
];

function ids(text: string, ingredients: typeof carbonara) {
	return resolveStepUses({ text, ingredientIds: [] }, ingredients).map(
		(item) => item.ingredientId,
	);
}

describe("resolveStepUses", () => {
	it("matches German carbonara steps, including a compound and a partial amount", () => {
		assert.deepEqual(
			ids("Die Spaghetti in Salzwasser kochen.", carbonara),
			["spaghetti", "salt"],
		);
		assert.deepEqual(ids("Guanciale knusprig braten.", carbonara), [
			"guanciale",
		]);
		assert.deepEqual(
			ids("Eier, Eigelb und Pecorino verrühren.", carbonara),
			["egg", "yolk", "pecorino"],
		);
		const partial = resolveStepUses(
			{ text: "Nur 100 g Spaghetti zugeben.", ingredientIds: [] },
			carbonara,
		);
		assert.deepEqual(partial, [
			{ ingredientId: "spaghetti", quantity: 100, unit: "g" },
		]);
	});

	it("matches an English smash burger step from names and synonyms", () => {
		assert.deepEqual(ids("Smash the beef and cook the patties.", burger), [
			"beef",
		]);
		assert.deepEqual(ids("Toast the buns with butter.", burger), [
			"bun",
			"butter",
		]);
		assert.deepEqual(ids("Add cheddar, onion, and pickles.", burger), [
			"cheddar",
			"onion",
			"pickle",
		]);
	});

	it("hides a step that names no ingredient", () => {
		assert.deepEqual(ids("Heat a pan until it is hot.", carbonara), []);
	});

	it("keeps a stored link when the step text uses another wording", () => {
		assert.deepEqual(
			resolveStepUses(
				{
					text: "Cook the noodles.",
					ingredientIds: ["spaghetti"],
				},
				carbonara,
			),
			[{ ingredientId: "spaghetti", quantity: null, unit: null }],
		);
	});
});

describe("stepIngredientLine", () => {
	it("scales the full amount and joins with a dot", () => {
		const line = stepIngredientLine({
			ingredients: carbonara,
			step: {
				text: "Die Spaghetti in Salzwasser kochen.",
				ingredientIds: [],
			},
			factor: 2,
			format: (quantity, unit) =>
				[quantity, unit].filter(Boolean).join(" "),
		});
		assert.equal(line, "400 g Spaghetti · Salz");
	});
});

describe("applyStepIngredients", () => {
	it("stores ids and uses without dropping the rest of the recipe", () => {
		const next = applyStepIngredients({
			title: "Carbonara",
			ingredients: carbonara,
			steps: [
				{
					id: "boil",
					text: "Die Spaghetti in Salzwasser kochen.",
					ingredientIds: [],
				},
			],
		});
		assert.equal(next.title, "Carbonara");
		const step = next.steps[0] as StepIngredientInput;
		assert.deepEqual(step.ingredientIds, ["spaghetti", "salt"]);
		assert.equal(step.uses?.[0]?.ingredientId, "spaghetti");
	});
});
