import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
	type IngredientIconRecord,
	parseRegenerateArgs,
	type RegenerateDeps,
	regenerateIngredientIcon,
	UnknownIngredientIconError,
} from "./regenerate";

function deps(initial: IngredientIconRecord | null) {
	let row = initial;
	const puts: string[] = [];
	const prompts: string[] = [];
	const inserted: string[] = [];
	const client: RegenerateDeps = {
		async find(key) {
			return row && row.key === key ? row : null;
		},
		async insert(input) {
			inserted.push(input.key);
			row = {
				id: "created",
				key: input.key,
				version: 1,
				storageUrl: null,
				prompt: input.prompt,
				status: "pending",
			};
			return row;
		},
		async save(_id, patch) {
			if (!row) {
				throw new Error("missing row");
			}
			row = {
				...row,
				...patch,
				status: patch.status ?? row.status,
				storageUrl:
					patch.storageUrl === undefined
						? row.storageUrl
						: patch.storageUrl,
				version: patch.version ?? row.version,
				prompt: patch.prompt ?? row.prompt,
			};
		},
		async render(prompt) {
			prompts.push(prompt);
			return {
				webp: new Uint8Array([1, 2, 3]),
				model: "mock",
				prompt,
			};
		},
		async put(key) {
			puts.push(key);
			return { url: `https://cdn.example/${key}` };
		},
	};

	return {
		client,
		puts,
		prompts,
		inserted,
		current: () => row,
	};
}

describe("regenerateIngredientIcon", () => {
	it("overwrites the same object and bumps the version", async () => {
		const harness = deps({
			id: "1",
			key: "black-pepper-ground",
			version: 1,
			storageUrl:
				"https://cdn.example/ingredient/black-pepper-ground.webp",
			prompt: "old",
			status: "ready",
		});

		const first = await regenerateIngredientIcon({
			key: "pepper",
			deps: harness.client,
		});
		const second = await regenerateIngredientIcon({
			key: "black-pepper-ground",
			deps: harness.client,
		});

		assert.deepEqual(harness.puts, [
			"ingredient/black-pepper-ground.webp",
			"ingredient/black-pepper-ground.webp",
		]);
		assert.equal(first.version, 2);
		assert.equal(second.version, 3);
		assert.equal(harness.current()?.version, 3);
		assert.equal(harness.inserted.length, 0);
		assert.match(first.url, /ingredient\/black-pepper-ground\.webp$/);
		assert.match(
			harness.prompts[0] ?? "",
			/Subject: raw black pepper, ground\./,
		);
	});

	it("refuses unknown keys unless --create, and keeps whole pepper separate", async () => {
		const harness = deps(null);
		await assert.rejects(
			() =>
				regenerateIngredientIcon({
					key: "saffron",
					deps: harness.client,
				}),
			UnknownIngredientIconError,
		);
		assert.deepEqual(harness.puts, []);

		const created = await regenerateIngredientIcon({
			key: "saffron",
			create: true,
			deps: harness.client,
		});
		assert.equal(created.objectKey, "ingredient/saffron.webp");
		assert.equal(created.version, 1);

		const whole = deps(null);
		const rendered = await regenerateIngredientIcon({
			key: "black-pepper-whole",
			create: true,
			promptExtra: "show the peppercorns",
			deps: whole.client,
		});
		assert.equal(rendered.objectKey, "ingredient/black-pepper-whole.webp");
		assert.match(
			whole.prompts[0] ?? "",
			/Subject: raw black pepper, whole\..*show the peppercorns/,
		);
		assert.notEqual(rendered.key, "black-pepper-ground");
	});

	it("parses cli args and does not touch billing", () => {
		assert.deepEqual(parseRegenerateArgs(["black-pepper-ground"]), {
			key: "black-pepper-ground",
			promptExtra: undefined,
			create: false,
		});
		assert.deepEqual(
			parseRegenerateArgs([
				"pepper",
				"--create",
				"--prompt-extra",
				"closer crop",
			]),
			{ key: "pepper", promptExtra: "closer crop", create: true },
		);
		assert.throws(() => parseRegenerateArgs([]));

		const source = readFileSync(
			new URL("./regenerate.ts", import.meta.url),
			"utf8",
		);
		assert.equal(source.includes("@repo/payments"), false);
		assert.equal(source.includes("assertImportAllowed"), false);
		const jobs = readFileSync(
			new URL("./jobs.ts", import.meta.url),
			"utf8",
		);
		assert.equal(jobs.includes("@repo/payments"), false);
	});
});
