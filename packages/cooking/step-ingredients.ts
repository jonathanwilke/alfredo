export type StepIngredientRef = {
	id: string;
	name: string;
	canonicalKey?: string | null;
	quantity: number | null;
	unit: string | null;
};

export type StepIngredientUse = {
	ingredientId: string;
	quantity: number | null;
	unit: string | null;
};

export type StepIngredientInput = {
	text: string;
	ingredientIds?: string[];
	uses?: {
		ingredientId: string;
		quantity?: number | null;
		unit?: string | null;
	}[];
};

const SYNONYMS: Record<string, string[]> = {
	egg: ["ei", "eier"],
	"egg-yolk": ["eigelb", "eidotter", "yolk", "egg yolk"],
	spaghetti: ["spaghetti", "spagetti"],
	guanciale: ["guanciale"],
	pecorino: ["pecorino", "pecorino romano"],
	"black-pepper": ["pfeffer", "schwarzer pfeffer", "pepper", "black pepper"],
	salt: ["salz", "salt"],
	onion: ["zwiebel", "zwiebeln", "onion", "onions"],
	pickle: ["gurke", "gewürzgurke", "gewuerzgurke", "pickle", "pickles"],
	"ground-beef": [
		"hackfleisch",
		"rinderhack",
		"ground beef",
		"beef",
		"patty",
		"patties",
	],
	cheddar: ["cheddar"],
	butter: ["butter"],
	ketchup: ["ketchup", "ketschup"],
	mustard: ["senf", "mustard"],
	"burger-bun": [
		"brötchen",
		"broetchen",
		"brotchen",
		"burgerbrötchen",
		"bun",
		"buns",
		"brioche",
	],
	garlic: ["knoblauch", "garlic"],
	"olive-oil": ["olivenöl", "olivenoel", "olive oil"],
	parmesan: ["parmesan", "parmigiano"],
	cream: ["sahne", "rahm", "cream"],
	milk: ["milch", "milk"],
	flour: ["mehl", "flour"],
	sugar: ["zucker", "sugar"],
	rice: ["reis", "rice"],
	potato: ["kartoffel", "kartoffeln", "potato", "potatoes"],
	tomato: ["tomate", "tomaten", "tomato", "tomatoes"],
	bacon: ["speck", "bacon"],
	chicken: ["hähnchen", "haehnchen", "huhn", "chicken"],
	lemon: ["zitrone", "zitronen", "lemon"],
};

const COMPOUND_SUFFIX =
	"(?:wasser|water|pulver|oel|öl|sauce|saft|sud|brühe|bruehe)";

const UNIT =
	"g|kg|mg|ml|l|el|tl|tsp|tbsp|stk|stück|stueck|prise|prisen|cup|cups|lb|oz";

function lower(value: string) {
	return value.toLocaleLowerCase("de");
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inflect(word: string) {
	const forms = new Set<string>([word]);
	if (word.length < 4) {
		return forms;
	}
	if (word.endsWith("ies")) {
		forms.add(`${word.slice(0, -3)}y`);
	} else if (word.endsWith("es")) {
		forms.add(word.slice(0, -2));
	} else if (word.endsWith("en")) {
		forms.add(word.slice(0, -2));
	} else if (word.endsWith("s") && !word.endsWith("ss")) {
		forms.add(word.slice(0, -1));
	} else if (word.endsWith("n")) {
		forms.add(word.slice(0, -1));
	} else if (word.endsWith("e")) {
		forms.add(word.slice(0, -1));
	} else {
		forms.add(`${word}s`);
		forms.add(`${word}n`);
		forms.add(`${word}en`);
	}
	return forms;
}

function phrasesFor(ingredient: StepIngredientRef) {
	const phrases = new Set<string>();
	const add = (value: string | null | undefined) => {
		const trimmed = value?.trim();
		if (!trimmed) {
			return;
		}
		const words = lower(trimmed).split(/\s+/).filter(Boolean);
		if (words.length === 0) {
			return;
		}
		phrases.add(words.join(" "));
		const last = words.at(-1);
		if (!last) {
			return;
		}
		for (const form of inflect(last)) {
			phrases.add([...words.slice(0, -1), form].join(" "));
		}
	};

	add(ingredient.name);
	add(ingredient.canonicalKey?.replace(/-/g, " "));
	const extras = ingredient.canonicalKey
		? SYNONYMS[ingredient.canonicalKey]
		: undefined;
	for (const extra of extras ?? []) {
		add(extra);
	}
	return [...phrases].filter((phrase) => phrase.length >= 2);
}

type Hit = {
	ingredient: StepIngredientRef;
	start: number;
	end: number;
	length: number;
};

function parsePartial(
	before: string,
	ingredient: StepIngredientRef,
): { quantity: number; unit: string | null } | null {
	const half =
		/(?:hälfte|haelfte|half)(?:\s+(?:der|des|vom|von|of|the))?\s*$/iu;
	if (half.test(before) && ingredient.quantity != null) {
		return { quantity: ingredient.quantity / 2, unit: ingredient.unit };
	}
	const fraction = before.match(/(?:^|\s)(½|¼|¾|\d+\s*\/\s*\d+)\s*$/u);
	if (fraction?.[1] && ingredient.quantity != null) {
		const token = fraction[1];
		const value =
			token === "½"
				? 0.5
				: token === "¼"
					? 0.25
					: token === "¾"
						? 0.75
						: (() => {
								const [num, den] = token
									.split("/")
									.map((part) => Number(part.trim()));
								return den ? num / den : Number.NaN;
							})();
		if (Number.isFinite(value)) {
			return {
				quantity: ingredient.quantity * value,
				unit: ingredient.unit,
			};
		}
	}
	const amount = before.match(
		new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIT})?\\s*$`, "iu"),
	);
	if (!amount?.[1]) {
		return null;
	}
	const quantity = Number(amount[1].replace(",", "."));
	if (!Number.isFinite(quantity)) {
		return null;
	}
	const unit = amount[2]?.toLocaleLowerCase("de") ?? null;
	if (
		ingredient.quantity != null &&
		Math.abs(quantity - ingredient.quantity) < 0.001 &&
		(unit == null || unit === ingredient.unit?.toLocaleLowerCase("de"))
	) {
		return null;
	}
	return { quantity, unit: unit ?? ingredient.unit };
}

function sameUse(left: number | null, right: number | null) {
	if (left == null || right == null) {
		return left == null && right == null;
	}
	return Math.abs(left - right) < 0.001;
}

function matchStep(
	step: StepIngredientInput,
	ingredients: StepIngredientRef[],
) {
	const byId = new Map(ingredients.map((item) => [item.id, item]));
	if (step.uses && step.uses.length > 0) {
		return step.uses.flatMap((use) => {
			if (!byId.has(use.ingredientId)) {
				return [];
			}
			return [
				{
					ingredientId: use.ingredientId,
					quantity: use.quantity ?? null,
					unit: use.unit ?? null,
				},
			];
		});
	}

	const text = lower(step.text);
	const limited =
		step.ingredientIds && step.ingredientIds.length > 0
			? ingredients.filter((item) =>
					step.ingredientIds?.includes(item.id),
				)
			: ingredients;
	const catalog = limited.flatMap((ingredient) =>
		phrasesFor(ingredient).map((phrase) => ({ ingredient, phrase })),
	);
	catalog.sort((left, right) => right.phrase.length - left.phrase.length);
	const hits: Hit[] = [];
	if (catalog.length > 0) {
		const pattern = new RegExp(
			`(?:^|[^\\p{L}\\p{N}])(${catalog.map((item) => escapeRegExp(item.phrase)).join("|")})(?=$|[^\\p{L}\\p{N}]|${COMPOUND_SUFFIX})`,
			"giu",
		);
		for (const match of text.matchAll(pattern)) {
			const phrase = lower(match[1] ?? "");
			const owner = catalog.find((item) => item.phrase === phrase);
			if (!owner || match.index == null) {
				continue;
			}
			const start = match.index + match[0].lastIndexOf(match[1] ?? "");
			hits.push({
				ingredient: owner.ingredient,
				start,
				end: start + phrase.length,
				length: phrase.length,
			});
		}
	}

	hits.sort(
		(left, right) => right.length - left.length || left.start - right.start,
	);
	const kept: Hit[] = [];
	for (const hit of hits) {
		const overlaps = kept.some(
			(item) =>
				item.ingredient.id === hit.ingredient.id ||
				(hit.start < item.end && hit.end > item.start),
		);
		if (!overlaps) {
			kept.push(hit);
		}
	}
	kept.sort((left, right) => left.start - right.start);

	const matched = kept.map((hit) => {
		const partial = parsePartial(
			step.text.slice(0, hit.start),
			hit.ingredient,
		);
		return {
			ingredientId: hit.ingredient.id,
			quantity: partial?.quantity ?? null,
			unit: partial?.unit ?? null,
		};
	});
	if (!step.ingredientIds || step.ingredientIds.length === 0) {
		return matched;
	}
	const seen = new Set(matched.map((item) => item.ingredientId));
	const rest = step.ingredientIds.flatMap((id) => {
		if (seen.has(id) || !byId.has(id)) {
			return [];
		}
		return [{ ingredientId: id, quantity: null, unit: null }];
	});
	return [...matched, ...rest];
}

/** Ingredients a step uses. Stored links win. Otherwise the step text is matched. */
export function resolveStepUses(
	step: StepIngredientInput,
	ingredients: StepIngredientRef[],
): StepIngredientUse[] {
	return matchStep(step, ingredients);
}

export function stepIngredientLine(input: {
	ingredients: StepIngredientRef[];
	step: StepIngredientInput;
	factor: number;
	format: (quantity: number, unit: string | null) => string;
}) {
	const uses = resolveStepUses(input.step, input.ingredients);
	const byId = new Map(input.ingredients.map((item) => [item.id, item]));
	const parts = uses.flatMap((use) => {
		const ingredient = byId.get(use.ingredientId);
		if (!ingredient) {
			return [];
		}
		const quantity = use.quantity ?? ingredient.quantity;
		const unit = use.unit ?? ingredient.unit;
		const amount =
			quantity == null
				? null
				: input.format(quantity * input.factor, unit);
		return [[amount, ingredient.name].filter(Boolean).join(" ")];
	});
	return parts.length > 0 ? parts.join(" · ") : null;
}

export function applyStepIngredients<
	T extends {
		ingredients: StepIngredientRef[];
		steps: (StepIngredientInput & Record<string, unknown>)[];
	},
>(recipe: T): T {
	return {
		...recipe,
		steps: recipe.steps.map((step) => {
			const uses = resolveStepUses(step, recipe.ingredients);
			const previous = step.uses ?? [];
			const same =
				previous.length === uses.length &&
				previous.every(
					(item, index) =>
						item.ingredientId === uses[index]?.ingredientId &&
						sameUse(
							item.quantity ?? null,
							uses[index]?.quantity ?? null,
						),
				);
			if (
				same &&
				(step.ingredientIds ?? []).join("\0") ===
					uses.map((item) => item.ingredientId).join("\0")
			) {
				return step;
			}
			return {
				...step,
				ingredientIds: uses.map((item) => item.ingredientId),
				uses,
			};
		}),
	};
}
