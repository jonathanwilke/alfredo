import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertIngredientObjectKey } from "@repo/storage";
import {
	formatCleanupReport,
	objectKeyFromStorageUrl,
	parseCleanupArgs,
	runIngredientIconCleanup,
} from "./cleanup";

const urlForKey = (key: string) => `https://cdn.example/${key}`;

let rows: {
	id: string;
	key: string;
	storageUrl: string | null;
}[] = [];

function memory(objects: string[]) {
	const files = new Set(objects);
	const copied: [string, string][] = [];
	const deleted: string[] = [];
	const updates: { id: string; key: string; storageUrl?: string }[] = [];
	const dropped: string[] = [];

	return {
		files,
		copied,
		deleted,
		updates,
		dropped,
		async listObjects() {
			return [...files];
		},
		async copyObject(from: string, to: string) {
			assertIngredientObjectKey(from);
			assertIngredientObjectKey(to);
			if (!files.has(from)) {
				throw new Error(`missing ${from}`);
			}
			files.add(to);
			copied.push([from, to]);
		},
		async deleteObject(key: string) {
			if (!key.startsWith("ingredient/")) {
				throw new Error(`refusing ${key}`);
			}
			assertIngredientObjectKey(key);
			files.delete(key);
			deleted.push(key);
		},
		urlForKey,
		async loadRows() {
			return rows;
		},
		async updateRow(
			id: string,
			patch: { key: string; storageUrl?: string },
		) {
			updates.push({ id, ...patch });
		},
		async deleteRow(id: string) {
			dropped.push(id);
		},
	};
}

describe("ingredient icon cleanup", () => {
	it("parses storage keys and refuses recipe objects", () => {
		assert.equal(
			objectKeyFromStorageUrl(
				"https://cdn.example/icons/ingredient/onion-170.webp?v=2",
			),
			"ingredient/onion-170.webp",
		);
		assert.equal(
			objectKeyFromStorageUrl(
				"http://localhost:3000/icons/ingredient/black-pepper-ground.webp",
			),
			"ingredient/black-pepper-ground.webp",
		);
		assert.equal(
			objectKeyFromStorageUrl("https://cdn.example/recipe/dish-170.webp"),
			null,
		);
		assert.throws(() => assertIngredientObjectKey("recipe/dish-170.webp"));
		assert.doesNotThrow(() =>
			assertIngredientObjectKey("ingredient/onion-170.webp"),
		);
		assert.deepEqual(parseCleanupArgs([]), { apply: false });
		assert.deepEqual(parseCleanupArgs(["--apply"]), { apply: true });
		assert.deepEqual(parseCleanupArgs(["--apply", "--dry-run"]), {
			apply: false,
		});
	});

	it("dry-run reports copies and deletes without touching storage", async () => {
		rows = [
			{
				id: "row-onion",
				key: "onion",
				storageUrl: "https://cdn.example/ingredient/onion-170.webp",
			},
		];
		const store = memory([
			"ingredient/onion-170.webp",
			"ingredient/onion-180.webp",
			"recipe/dish-170.webp",
		]);
		const report = await runIngredientIconCleanup({
			apply: false,
			...store,
		});
		const text = formatCleanupReport(report);

		assert.equal(report.applied, false);
		assert.deepEqual(store.copied, []);
		assert.deepEqual(store.deleted, []);
		assert.deepEqual(store.updates, []);
		assert.deepEqual(store.dropped, []);
		assert.equal(store.files.has("recipe/dish-170.webp"), true);
		assert.match(text, /dry-run/);
		assert.match(text, /recipe\/ objects are not listed or deleted/);
		assert.match(text, /Dry run only/);
		assert.match(
			text,
			/copy ingredient\/onion-170\.webp -> ingredient\/onion\.webp/,
		);
		assert.match(text, /would delete ingredient\/onion-170\.webp/);
		assert.match(text, /would delete ingredient\/onion-180\.webp/);
		assert.match(text, /ignored recipe\/dish-170\.webp/);
		assert.deepEqual(
			report.deletes.includes("recipe/dish-170.webp"),
			false,
		);
	});

	it("apply copies the referenced object, updates the row, and deletes orphans", async () => {
		rows = [
			{
				id: "row-onion",
				key: "onion",
				storageUrl:
					"https://cdn.example/icons/ingredient/onion-170.webp",
			},
		];
		const store = memory([
			"ingredient/onion-170.webp",
			"ingredient/onion-180.webp",
			"recipe/dish-170.webp",
		]);
		const report = await runIngredientIconCleanup({
			apply: true,
			...store,
		});

		assert.equal(report.applied, true);
		assert.deepEqual(store.copied, [
			["ingredient/onion-170.webp", "ingredient/onion.webp"],
		]);
		assert.deepEqual(store.updates, [
			{
				id: "row-onion",
				key: "onion",
				storageUrl: "https://cdn.example/ingredient/onion.webp",
			},
		]);
		assert.deepEqual(store.deleted.sort(), [
			"ingredient/onion-170.webp",
			"ingredient/onion-180.webp",
		]);
		assert.equal(store.files.has("ingredient/onion.webp"), true);
		assert.equal(store.files.has("recipe/dish-170.webp"), true);
		assert.equal(
			formatCleanupReport(report).includes("Dry run only"),
			false,
		);
	});

	it("collapses pepper onto black-pepper-ground and keeps whole pepper", async () => {
		rows = [
			{
				id: "alias",
				key: "pepper",
				storageUrl: "https://cdn.example/ingredient/pepper-100.webp",
			},
			{
				id: "ground",
				key: "black-pepper-ground",
				storageUrl: null,
			},
			{
				id: "whole",
				key: "black-pepper-whole",
				storageUrl:
					"https://cdn.example/ingredient/black-pepper-whole.webp",
			},
		];
		const store = memory([
			"ingredient/pepper-100.webp",
			"ingredient/black-pepper-whole.webp",
		]);
		const report = await runIngredientIconCleanup({
			apply: true,
			...store,
		});

		assert.deepEqual(store.copied, [
			[
				"ingredient/pepper-100.webp",
				"ingredient/black-pepper-ground.webp",
			],
		]);
		assert.deepEqual(store.updates, [
			{
				id: "ground",
				key: "black-pepper-ground",
				storageUrl:
					"https://cdn.example/ingredient/black-pepper-ground.webp",
			},
		]);
		assert.deepEqual(store.dropped, ["alias"]);
		assert.equal(
			store.files.has("ingredient/black-pepper-ground.webp"),
			true,
		);
		assert.equal(
			store.files.has("ingredient/black-pepper-whole.webp"),
			true,
		);
		assert.equal(store.files.has("ingredient/pepper-100.webp"), false);
		assert.equal(
			report.deletes.includes("ingredient/black-pepper-whole.webp"),
			false,
		);
	});
});
