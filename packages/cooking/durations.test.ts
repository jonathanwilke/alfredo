import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decorateStep, findAllDurations } from "./steps";

describe("findAllDurations", () => {
	it("uses the longer end of a range", () => {
		const spans = findAllDurations(
			"Bake 45–50 Minuten, then rest 5 minutes.",
		);
		assert.deepEqual(
			spans.map((span) => span.seconds),
			[50 * 60, 5 * 60],
		);
		assert.equal(
			"Bake 45–50 Minuten, then rest 5 minutes.".slice(
				spans[0]?.start,
				spans[0]?.end,
			),
			"45–50 Minuten",
		);
	});

	it("reads German and English units, including words and fractions", () => {
		assert.deepEqual(
			findAllDurations("eine Stunde und 30 Sekunden").map(
				(span) => span.seconds,
			),
			[3600, 30],
		);
		assert.equal(findAllDurations("2 hours")[0]?.seconds, 7200);
		assert.equal(findAllDurations("zehn Minuten")[0]?.seconds, 600);
		assert.equal(findAllDurations("1,5 Stunden")[0]?.seconds, 5400);
		assert.equal(findAllDurations("45-50 minutes")[0]?.seconds, 3000);
	});
});

describe("decorateStep", () => {
	it("marks each duration as a timer chip", () => {
		const pieces = decorateStep(
			"Let cool 5 minutes, then rest eine Stunde.",
			[],
		);
		const timers = pieces.filter((piece) => piece.timer);
		assert.deepEqual(
			timers.map((piece) => piece.timerSeconds),
			[300, 3600],
		);
		assert.deepEqual(
			timers.map((piece) => piece.text),
			["5 minutes", "eine Stunde"],
		);
	});
});
