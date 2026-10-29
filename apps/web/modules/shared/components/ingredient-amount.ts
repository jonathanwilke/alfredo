const TABLESPOON = /^(el|esslöffel|essloeffel|tbsp|tablespoons?)$/i;
const GRAM = /^(g|gramm|gramme|grams?)$/i;
const KILO = /^(kg|kilo|kilogramm|kilograms?)$/i;

const FORM_STEMS = new Set([
	"gehackt",
	"gemahlen",
	"gerieben",
	"gewürfelt",
	"geschnitten",
	"geviertelt",
	"gestiftelt",
	"geraspelt",
	"gepresst",
	"geschält",
	"geschalt",
	"entkernt",
	"abgetropft",
	"zerdrückt",
	"zerkleinert",
	"passiert",
	"püriert",
	"pulverisiert",
	"gemischt",
	"getrocknet",
	"stückig",
	"pulver",
	"chopped",
	"minced",
	"ground",
	"grated",
	"diced",
	"sliced",
	"crushed",
	"dried",
	"cubed",
]);

const FORM_MODIFIERS = new Set([
	"fein",
	"grob",
	"frisch",
	"finely",
	"coarsely",
	"freshly",
]);

const ADJECTIVE_STEMS = new Set([
	"groß",
	"klein",
	"mittel",
	"mittelgroß",
	"schwarz",
	"weiß",
	"rot",
	"grün",
	"gelb",
	"braun",
	"süß",
	"sauer",
	"scharf",
	"mild",
	"herb",
	"trocken",
	"frisch",
	"fein",
	"grob",
	"jung",
	"alt",
	"roh",
	"ganz",
	"halb",
	"edel",
	"edelsüß",
	"dick",
	"dünn",
	"lang",
	"kurz",
	"weich",
	"hart",
	"zart",
	"mager",
	"reif",
	"bio",
	"italian",
	"french",
	"spanish",
	"medium",
	"large",
	"small",
	"black",
	"white",
	"red",
	"fresh",
	"dry",
	"sweet",
	"hot",
]);

const ADJECTIVE_SUFFIXES = [
	"isch",
	"lich",
	"ig",
	"bar",
	"sam",
	"haft",
	"los",
	"ell",
];

function blankToNull(value: string | null | undefined) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function isTablespoon(unit: string | null) {
	return unit != null && TABLESPOON.test(unit);
}

function roundToHalf(value: number) {
	const rounded = Math.round(value * 2) / 2;
	if (rounded === 0 && value > 0) {
		return 0.5;
	}
	return rounded;
}

function formatNumber(value: number, locale: string) {
	return value.toLocaleString(locale, {
		maximumFractionDigits: 3,
		useGrouping: false,
	});
}

function unitsEqual(left: string | null, right: string | null) {
	return (
		(left ?? "").toLocaleLowerCase("de") ===
		(right ?? "").toLocaleLowerCase("de")
	);
}

export function scaleMeasure(
	value: number,
	unit: string | null | undefined,
	locale: string,
) {
	let shown = value;
	let shownUnit = blankToNull(unit);
	if (isTablespoon(shownUnit)) {
		shown = roundToHalf(shown);
	} else if (shownUnit && KILO.test(shownUnit)) {
		if (shown < 1) {
			shown = Math.round(shown * 1000);
			shownUnit = "g";
		}
	} else if (shownUnit && GRAM.test(shownUnit) && shown >= 1000) {
		shown /= 1000;
		shownUnit = "kg";
	}

	return {
		quantity: formatNumber(shown, locale),
		unit: shownUnit,
		unitChanged: !unitsEqual(shownUnit, blankToNull(unit)),
	};
}

/** Amount line for the ingredient list, including a unit change from g to kg. */
export function formatAmount(
	value: number,
	unit: string | null | undefined,
	locale: string,
) {
	const scaled = scaleMeasure(value, unit, locale);
	return [scaled.quantity, scaled.unit].filter(Boolean).join(" ");
}

function knownStem(value: string) {
	return FORM_STEMS.has(value) || ADJECTIVE_STEMS.has(value);
}

function attributeStem(word: string) {
	const lower = word.toLocaleLowerCase("de");
	if (knownStem(lower) || FORM_MODIFIERS.has(lower)) {
		return lower;
	}
	for (const ending of ["em", "en", "er", "es", "e"]) {
		if (!lower.endsWith(ending) || lower.length - ending.length < 3) {
			continue;
		}
		const cut = lower.slice(0, -ending.length);
		if (knownStem(cut)) {
			return cut;
		}
		if (cut.startsWith("ge") && cut.endsWith("t") && cut.length >= 5) {
			return cut;
		}
		if (
			ADJECTIVE_SUFFIXES.some(
				(suffix) =>
					cut.endsWith(suffix) && cut.length >= suffix.length + 3,
			) ||
			cut.endsWith("groß") ||
			cut.endsWith("klein")
		) {
			return cut;
		}
	}
	return null;
}

function attributePhrase(phrase: string) {
	const words = phrase.trim().split(/\s+/).filter(Boolean);
	if (
		words.length === 2 &&
		FORM_MODIFIERS.has(words[0]?.toLocaleLowerCase("de") ?? "")
	) {
		const stem = attributeStem(words[1] ?? "");
		if (stem) {
			return `${words[0]?.toLocaleLowerCase("de")} ${stem}`;
		}
	}
	if (words.length === 1) {
		return (
			attributeStem(words[0] ?? "") ?? words[0]?.toLocaleLowerCase("de")
		);
	}
	return phrase.trim();
}

function inferAttributes(name: string) {
	const attributes: string[] = [];
	let rest = name.trim();

	const paren = rest.match(/^(.+?)\s*\(([^)]+)\)$/u);
	if (paren?.[1] && paren[2]) {
		rest = paren[1].trim();
		attributes.push(attributePhrase(paren[2]));
	}

	const comma = rest.match(/^(.+?),\s*(.+)$/u);
	if (comma?.[1] && comma[2]) {
		rest = comma[1].trim();
		attributes.push(attributePhrase(comma[2]));
	}

	const mill = rest.match(/^(.+?)\s+aus der Mühle$/iu);
	if (mill?.[1]) {
		rest = mill[1].trim();
		attributes.push("aus der Mühle");
	}

	const words = rest.split(/\s+/).filter(Boolean);
	const leading: string[] = [];
	let index = 0;
	while (index < words.length - 1) {
		const stem = attributeStem(words[index] ?? "");
		if (!stem) {
			break;
		}
		const next = words[index + 1] ?? "";
		const nextStem =
			index + 1 < words.length - 1 ? attributeStem(next) : null;
		if (FORM_MODIFIERS.has(stem) && nextStem) {
			leading.push(`${stem} ${nextStem}`);
			index += 2;
			continue;
		}
		leading.push(stem);
		index += 1;
	}

	if (index > 0) {
		rest = words.slice(index).join(" ");
		attributes.unshift(...leading);
	}

	return {
		name: rest,
		form: attributes.length > 0 ? attributes.join(", ") : null,
	};
}

export function presentIngredient(ingredient: {
	name: string;
	form?: string | null;
}) {
	const explicit = blankToNull(ingredient.form);
	const inferred = inferAttributes(ingredient.name);
	if (!explicit) {
		return inferred;
	}
	const extras = (inferred.form ?? "")
		.split(",")
		.map((part) => part.trim())
		.filter(
			(part) =>
				part &&
				part.toLocaleLowerCase("de") !==
					explicit.toLocaleLowerCase("de"),
		);
	return {
		name: inferred.name,
		form: [explicit, ...extras].join(", "),
	};
}
