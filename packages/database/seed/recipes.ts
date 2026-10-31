import type { ExtractedRecipe } from "@repo/ai";

export type CuratedFixture = {
	sourceUrl: string;
	isCurated: true;
	source: "curated";
	translations: Record<"de" | "en", ExtractedRecipe>;
};

function recipe(
	de: ExtractedRecipe,
	en: ExtractedRecipe,
): Record<"de" | "en", ExtractedRecipe> {
	return { de, en };
}

const tomatoPasta = recipe(
	{
		title: "Tomatenpasta",
		description: "Kurze Pasta in einer einfachen Tomatensauce.",
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
			{
				id: "tomato",
				name: "Tomaten",
				canonicalKey: "tomato",
				quantity: 400,
				unit: "g",
				form: "gehackt",
			},
		],
		steps: [
			{
				id: "boil",
				text: "Die Pasta in Salzwasser kochen.",
				ingredientIds: ["pasta"],
				uses: [{ ingredientId: "pasta", quantity: null, unit: null }],
				timerSeconds: 600,
			},
			{
				id: "sauce",
				text: "Die Tomaten kurz einkochen und mit der Pasta mischen.",
				ingredientIds: ["tomato", "pasta"],
				uses: [
					{ ingredientId: "tomato", quantity: null, unit: null },
					{ ingredientId: "pasta", quantity: null, unit: null },
				],
				timerSeconds: 300,
			},
		],
	},
	{
		title: "Tomato pasta",
		description: "Short pasta in a simple tomato sauce.",
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
			{
				id: "tomato",
				name: "Tomatoes",
				canonicalKey: "tomato",
				quantity: 400,
				unit: "g",
				form: "chopped",
			},
		],
		steps: [
			{
				id: "boil",
				text: "Boil the pasta in salted water.",
				ingredientIds: ["pasta"],
				uses: [{ ingredientId: "pasta", quantity: null, unit: null }],
				timerSeconds: 600,
			},
			{
				id: "sauce",
				text: "Simmer the tomatoes, then toss them with the pasta.",
				ingredientIds: ["tomato", "pasta"],
				uses: [
					{ ingredientId: "tomato", quantity: null, unit: null },
					{ ingredientId: "pasta", quantity: null, unit: null },
				],
				timerSeconds: 300,
			},
		],
	},
);

const lentilSoup = recipe(
	{
		title: "Linsensuppe",
		description: "Eine milde Suppe aus roten Linsen.",
		image: null,
		servings: 4,
		prepTimeSeconds: 600,
		cookTimeSeconds: 1200,
		ingredients: [
			{
				id: "lentil",
				name: "Linsen",
				canonicalKey: "red-lentil",
				quantity: 200,
				unit: "g",
				form: "rot",
			},
		],
		steps: [
			{
				id: "simmer",
				text: "Die Linsen in Wasser weich kochen.",
				ingredientIds: ["lentil"],
				uses: [{ ingredientId: "lentil", quantity: null, unit: null }],
				timerSeconds: 1200,
			},
		],
	},
	{
		title: "Lentil soup",
		description: "A mild soup made from red lentils.",
		image: null,
		servings: 4,
		prepTimeSeconds: 600,
		cookTimeSeconds: 1200,
		ingredients: [
			{
				id: "lentil",
				name: "Lentils",
				canonicalKey: "red-lentil",
				quantity: 200,
				unit: "g",
				form: "red",
			},
		],
		steps: [
			{
				id: "simmer",
				text: "Simmer the lentils in water until soft.",
				ingredientIds: ["lentil"],
				uses: [{ ingredientId: "lentil", quantity: null, unit: null }],
				timerSeconds: 1200,
			},
		],
	},
);

export const curatedFixtures: CuratedFixture[] = [
	{
		sourceUrl: "https://ulivo.example/curated/tomato-pasta",
		isCurated: true,
		source: "curated",
		translations: tomatoPasta,
	},
	{
		sourceUrl: "https://ulivo.example/curated/lentil-soup",
		isCurated: true,
		source: "curated",
		translations: lentilSoup,
	},
];
