export interface StepIngredient {
	id: string;
	name: string;
	quantity: number | null;
	unit: string | null;
	scaledQuantity: string | null;
	scaledUnit?: string | null;
	canonicalKey: string | null;
}

export interface StepPiece {
	text: string;
	ingredient: StepIngredient | null;
	timer?: boolean;
	timerSeconds?: number;
	emphasis?: boolean;
	sourceStart: number;
	sourceEnd: number;
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameVariants(name: string) {
	const trimmed = name.trim();
	const withoutNotes = trimmed
		.replace(/\s*\([^)]*\)/g, "")
		.replace(/\s+/g, " ")
		.trim();
	const words = withoutNotes.split(" ").filter(Boolean);
	const last = words.length > 1 ? words.at(-1) : null;
	const variants = [trimmed, withoutNotes];
	if (last && last.length >= 4) {
		variants.push(last);
	}
	return [...new Set(variants.filter((variant) => variant.length >= 2))];
}

function sameQuantity(found: number, expected: number) {
	const difference = Math.abs(found - expected);
	return difference < 0.001 || difference / Math.max(expected, 0.001) < 0.02;
}

interface RawMatch {
	ingredient: StepIngredient;
	nameStart: number;
	nameEnd: number;
	quantityStart: number | null;
	numberStart: number | null;
	numberEnd: number | null;
}

function quantityBefore(before: string, ingredient: StepIngredient) {
	if (ingredient.quantity == null) {
		return null;
	}

	const match = before.match(/(\d+(?:[.,]\d+)?)\s*(\p{L}{1,16})?\s*$/u);
	if (!match || match.index == null) {
		return null;
	}

	const found = Number(match[1]?.replace(",", "."));
	if (!Number.isFinite(found) || !sameQuantity(found, ingredient.quantity)) {
		return null;
	}

	const unitWord = match[2];
	if (
		ingredient.unit &&
		unitWord &&
		unitWord.toLocaleLowerCase() !== ingredient.unit.toLocaleLowerCase()
	) {
		return null;
	}

	const numberStart = match.index;
	return {
		quantityStart: numberStart,
		numberStart,
		numberEnd: numberStart + (match[1]?.length ?? 0),
	};
}

function findMatches(text: string, ingredients: StepIngredient[]) {
	const candidates: RawMatch[] = [];

	for (const ingredient of ingredients) {
		for (const variant of nameVariants(ingredient.name)) {
			const pattern = new RegExp(
				`(?<![\\p{L}\\p{N}])${escapeRegExp(variant)}(?![\\p{L}\\p{N}])`,
				"giu",
			);
			for (const match of text.matchAll(pattern)) {
				const nameStart = match.index ?? 0;
				const nameEnd = nameStart + match[0].length;
				const quantity = quantityBefore(
					text.slice(0, nameStart),
					ingredient,
				);
				candidates.push({
					ingredient,
					nameStart,
					nameEnd,
					quantityStart: quantity?.quantityStart ?? null,
					numberStart: quantity?.numberStart ?? null,
					numberEnd: quantity?.numberEnd ?? null,
				});
			}
		}
	}

	candidates.sort(
		(a, b) =>
			(a.quantityStart ?? a.nameStart) -
				(b.quantityStart ?? b.nameStart) || b.nameEnd - a.nameEnd,
	);

	const chosen: RawMatch[] = [];
	let cursor = 0;
	for (const candidate of candidates) {
		const start = candidate.quantityStart ?? candidate.nameStart;
		if (start < cursor) {
			continue;
		}
		chosen.push(candidate);
		cursor = candidate.nameEnd;
	}

	const seenQuantity = new Set(
		chosen
			.filter((match) => match.quantityStart != null)
			.map((match) => match.ingredient.id),
	);
	const inserted = new Set<string>();

	return chosen.map((match) => {
		const precededByAmount = /(\d+(?:[.,]\d+)?)\s*(\p{L}{1,16})?\s*$/u.test(
			text.slice(0, match.nameStart),
		);
		const insertQuantity =
			match.quantityStart == null &&
			!precededByAmount &&
			!seenQuantity.has(match.ingredient.id) &&
			!inserted.has(match.ingredient.id) &&
			match.ingredient.scaledQuantity != null;
		if (insertQuantity) {
			inserted.add(match.ingredient.id);
		}
		return { ...match, insertQuantity };
	});
}

export function ingredientIconKey(value: string) {
	const key = value
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return key || null;
}

export function highlightStep(text: string, ingredients: StepIngredient[]) {
	const matches = findMatches(text, ingredients);
	const pieces: StepPiece[] = [];
	let cursor = 0;

	for (const match of matches) {
		const start = match.quantityStart ?? match.nameStart;
		if (start > cursor) {
			pieces.push({
				text: text.slice(cursor, start),
				ingredient: null,
				sourceStart: cursor,
				sourceEnd: start,
			});
		}

		let label = text.slice(start, match.nameEnd);
		if (
			match.numberStart != null &&
			match.numberEnd != null &&
			match.ingredient.scaledQuantity
		) {
			const numberStart = match.numberStart - start;
			let numberEnd = match.numberEnd - start;
			let replacement = match.ingredient.scaledQuantity;
			if (match.ingredient.scaledUnit) {
				const unit = label.slice(numberEnd).match(/^(\s*)(\p{L}+)/u);
				if (unit) {
					numberEnd += unit[0].length;
					replacement = `${match.ingredient.scaledQuantity}${unit[1]}${match.ingredient.scaledUnit}`;
				}
			}
			label =
				label.slice(0, numberStart) +
				replacement +
				label.slice(numberEnd);
		} else if (match.insertQuantity && match.ingredient.scaledQuantity) {
			const amount = [
				match.ingredient.scaledQuantity,
				match.ingredient.scaledUnit ?? match.ingredient.unit,
			]
				.filter(Boolean)
				.join(" ");
			label = `${amount} ${label}`;
		}

		pieces.push({
			text: label,
			ingredient: match.ingredient,
			sourceStart: start,
			sourceEnd: match.nameEnd,
		});
		cursor = match.nameEnd;
	}

	if (cursor < text.length) {
		pieces.push({
			text: text.slice(cursor),
			ingredient: null,
			sourceStart: cursor,
			sourceEnd: text.length,
		});
	}

	return pieces;
}

const DURATION_UNIT =
	"minuten|minutes|minute|mins?\\.?|sekunden|sekunde|sek\\.?|seconds?|secs?\\.?|stunden|stunde|std\\.?|hours?|hrs?\\.?";

const DURATION_WORDS: Record<string, number> = {
	ein: 1,
	eine: 1,
	eins: 1,
	one: 1,
	zwei: 2,
	two: 2,
	drei: 3,
	three: 3,
	vier: 4,
	four: 4,
	fünf: 5,
	five: 5,
	sechs: 6,
	six: 6,
	sieben: 7,
	seven: 7,
	acht: 8,
	eight: 8,
	neun: 9,
	nine: 9,
	zehn: 10,
	ten: 10,
};

function unitScale(unit: string) {
	const normalized = unit.toLocaleLowerCase().replace(/\./g, "");
	if (/^(sek|sec)/.test(normalized)) {
		return 1;
	}
	if (/^(stunde|std|hour|hr)/.test(normalized)) {
		return 3600;
	}
	return 60;
}

function durationMatches(amount: number, scale: number, seconds: number) {
	const expected = seconds / scale;
	if (scale === 60) {
		return Math.abs(Math.round(expected) - amount) < 0.01;
	}
	return Math.abs(expected - amount) <= Math.max(1, seconds * 0.1);
}

export function findDuration(text: string, seconds: number) {
	const pattern = new RegExp(
		`(?<![\\p{L}\\p{N}])(\\d+(?:[.,]\\d+)?|${Object.keys(DURATION_WORDS).join("|")})(?:\\s*[–-]\\s*(\\d+(?:[.,]\\d+)?))?\\s*(${DURATION_UNIT})(?![\\p{L}\\p{N}])`,
		"giu",
	);
	let best: { start: number; end: number; distance: number } | null = null;

	for (const match of text.matchAll(pattern)) {
		const raw = match[1]?.toLocaleLowerCase() ?? "";
		const first = DURATION_WORDS[raw] ?? Number(raw.replace(",", "."));
		const second = match[2] ? Number(match[2].replace(",", ".")) : null;
		const scale = unitScale(match[3] ?? "");
		const amounts = [first, second].filter(
			(amount): amount is number =>
				amount != null && Number.isFinite(amount),
		);
		if (
			!amounts.some((amount) => durationMatches(amount, scale, seconds))
		) {
			continue;
		}
		const start = match.index ?? 0;
		const closest = Math.min(
			...amounts.map((amount) => Math.abs(amount * scale - seconds)),
		);
		if (!best || closest < best.distance) {
			best = { start, end: start + match[0].length, distance: closest };
		}
	}

	return best ? { start: best.start, end: best.end } : null;
}

export interface DurationSpan {
	start: number;
	end: number;
	seconds: number;
}

const DURATION_RANGE = "[\\-\\u2013\\u2014]";

function durationPattern() {
	return new RegExp(
		`(?<![\\p{L}\\p{N}])(\\d+(?:[.,]\\d+)?|${Object.keys(DURATION_WORDS).join("|")})(?:\\s*${DURATION_RANGE}\\s*(\\d+(?:[.,]\\d+)?))?\\s*(${DURATION_UNIT})(?![\\p{L}\\p{N}])`,
		"giu",
	);
}

/** Every duration in the sentence. A range uses the longer end. */
export function findAllDurations(text: string): DurationSpan[] {
	const found: DurationSpan[] = [];
	for (const match of text.matchAll(durationPattern())) {
		const raw = match[1]?.toLocaleLowerCase() ?? "";
		const first = DURATION_WORDS[raw] ?? Number(raw.replace(",", "."));
		if (!Number.isFinite(first) || first <= 0) {
			continue;
		}
		const second = match[2] ? Number(match[2].replace(",", ".")) : null;
		const amount =
			second != null && Number.isFinite(second)
				? Math.max(first, second)
				: first;
		const seconds = Math.round(amount * unitScale(match[3] ?? ""));
		if (seconds <= 0) {
			continue;
		}
		const start = match.index ?? 0;
		found.push({ start, end: start + match[0].length, seconds });
	}
	return found;
}

export function decorateStep(text: string, ingredients: StepIngredient[]) {
	const base = placeEmphasis(
		highlightStep(text, ingredients),
		findEmphasis(text),
	);
	const ranges = findAllDurations(text);
	const placed = placeAllDurations(base, ranges);
	const covered = new Set(
		placed.filter((piece) => piece.timer).map((piece) => piece.sourceStart),
	);
	const extra = ranges
		.filter((range) => !covered.has(range.start))
		.map((range) => ({
			text: text.slice(range.start, range.end),
			ingredient: null,
			timer: true,
			timerSeconds: range.seconds,
			sourceStart: range.start,
			sourceEnd: range.end,
		}));
	return extra.length > 0 ? [...placed, ...extra] : placed;
}

function placeAllDurations(pieces: StepPiece[], ranges: DurationSpan[]) {
	let current = pieces;
	for (const range of ranges) {
		current = placeOneDuration(current, range);
	}
	return current;
}

function placeOneDuration(pieces: StepPiece[], range: DurationSpan) {
	const next: StepPiece[] = [];
	let placed = false;

	for (const piece of pieces) {
		const contains =
			range.start >= piece.sourceStart && range.end <= piece.sourceEnd;
		const exact = piece.text.length === piece.sourceEnd - piece.sourceStart;
		if (!contains || !exact || placed || piece.timer) {
			next.push(piece);
			continue;
		}

		const localStart = range.start - piece.sourceStart;
		const localEnd = range.end - piece.sourceStart;
		const before = piece.text.slice(0, localStart);
		const middle = piece.text.slice(localStart, localEnd);
		const after = piece.text.slice(localEnd);

		if (before) {
			next.push({
				...piece,
				text: before,
				timer: false,
				timerSeconds: undefined,
				sourceEnd: range.start,
			});
		}
		next.push({
			text: middle,
			ingredient: null,
			timer: true,
			timerSeconds: range.seconds,
			sourceStart: range.start,
			sourceEnd: range.end,
		});
		if (after) {
			next.push({
				...piece,
				text: after,
				timer: false,
				timerSeconds: undefined,
				sourceStart: range.end,
			});
		}
		placed = true;
	}

	return next;
}

export function placeDuration(
	pieces: StepPiece[],
	range: { start: number; end: number } | null,
) {
	if (!range) {
		return pieces;
	}

	const next: StepPiece[] = [];
	let placed = false;

	for (const piece of pieces) {
		const contains =
			range.start >= piece.sourceStart && range.end <= piece.sourceEnd;
		const exact = piece.text.length === piece.sourceEnd - piece.sourceStart;
		if (!contains || !exact || placed) {
			next.push(piece);
			continue;
		}

		const localStart = range.start - piece.sourceStart;
		const localEnd = range.end - piece.sourceStart;
		const before = piece.text.slice(0, localStart);
		const middle = piece.text.slice(localStart, localEnd);
		const after = piece.text.slice(localEnd);

		if (before) {
			next.push({
				...piece,
				text: before,
				sourceEnd: range.start,
			});
		}
		next.push({
			text: middle,
			ingredient: null,
			timer: true,
			sourceStart: range.start,
			sourceEnd: range.end,
		});
		if (after) {
			next.push({
				...piece,
				text: after,
				sourceStart: range.end,
			});
		}
		placed = true;
	}

	return next;
}

const HEAT_MODE = [
	"ober\\s*-\\s*/\\s*unterhitze",
	"ober\\s*/\\s*unterhitze",
	"ober\\s*-\\s*und\\s+unterhitze",
	"oberhitze",
	"unterhitze",
	"umluft",
	"hei[ßs]luft",
	"grillstufe",
	"grill",
	"intensivhitze",
	"konvektion",
	"dampf",
	"fan(?:\\s+oven)?",
	"conventional(?:\\s+oven)?",
	"broil",
].join("|");

const HEAT_LEVEL =
	"(?:niedrig|mittler|mittel|hoch|stark|schwach|klein|gro[ßs]|voll|höchst)\\p{L}*\\s+(?:hitze|flamme|stufe)|stufe\\s+\\d+|(?:low|medium|medium-high|high)\\s+heat";

const TEMPERATURE = "\\d+(?:[.,]\\d+)?\\s*(?:°\\s*[cf]?|grad(?:\\s+celsius)?)";

export function findEmphasis(text: string) {
	const pattern = new RegExp(
		`(?<![\\p{L}\\p{N}])(?:(?:${TEMPERATURE})(?:\\s+(?:${HEAT_MODE}))?|${HEAT_MODE}|${HEAT_LEVEL})(?![\\p{L}\\p{N}])`,
		"giu",
	);
	const ranges: { start: number; end: number }[] = [];

	for (const match of text.matchAll(pattern)) {
		const start = match.index ?? 0;
		const end = start + match[0].length;
		const previous = ranges.at(-1);
		if (previous && start <= previous.end) {
			previous.end = Math.max(previous.end, end);
			continue;
		}
		ranges.push({ start, end });
	}

	return ranges;
}

export function placeEmphasis(
	pieces: StepPiece[],
	ranges: { start: number; end: number }[],
) {
	let current = pieces;

	for (const range of ranges) {
		const next: StepPiece[] = [];
		let placed = false;

		for (const piece of current) {
			const contains =
				range.start >= piece.sourceStart &&
				range.end <= piece.sourceEnd;
			const exact =
				piece.text.length === piece.sourceEnd - piece.sourceStart;
			if (
				!contains ||
				!exact ||
				placed ||
				piece.ingredient ||
				piece.timer ||
				piece.emphasis
			) {
				next.push(piece);
				continue;
			}

			const localStart = range.start - piece.sourceStart;
			const localEnd = range.end - piece.sourceStart;
			const before = piece.text.slice(0, localStart);
			const middle = piece.text.slice(localStart, localEnd);
			const after = piece.text.slice(localEnd);

			if (before) {
				next.push({ ...piece, text: before, sourceEnd: range.start });
			}
			next.push({
				text: middle,
				ingredient: null,
				emphasis: true,
				sourceStart: range.start,
				sourceEnd: range.end,
			});
			if (after) {
				next.push({ ...piece, text: after, sourceStart: range.end });
			}
			placed = true;
		}

		current = next;
	}

	return current;
}
