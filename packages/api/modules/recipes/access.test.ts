import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	canReadRecipeIcons,
	clampText,
	createShareToken,
	publicRecipePath,
	recipeVisibility,
	sharedRecipePath,
} from "./access";

describe("recipeVisibility", () => {
	it("keeps curated recipes public", () => {
		assert.equal(
			recipeVisibility({
				isCurated: true,
				ownerUserId: null,
				viewerUserId: null,
				hasImport: false,
			}),
			"public",
		);
	});

	it("hides a private recipe from everyone except the owner", () => {
		assert.equal(
			recipeVisibility({
				isCurated: false,
				ownerUserId: "user_a",
				viewerUserId: null,
				hasImport: false,
			}),
			"hidden",
		);
		assert.equal(
			recipeVisibility({
				isCurated: false,
				ownerUserId: "user_a",
				viewerUserId: "user_b",
				hasImport: false,
			}),
			"hidden",
		);
		assert.equal(
			recipeVisibility({
				isCurated: false,
				ownerUserId: "user_a",
				viewerUserId: "user_a",
				hasImport: false,
			}),
			"owner",
		);
		assert.equal(
			recipeVisibility({
				isCurated: false,
				ownerUserId: null,
				viewerUserId: "user_a",
				hasImport: true,
			}),
			"owner",
		);
	});
});

describe("canReadRecipeIcons", () => {
	it("allows icons for a shared recipe without revealing an unshared one", () => {
		assert.equal(
			canReadRecipeIcons({
				isCurated: false,
				shareToken: "token",
				ownerUserId: "user_a",
				viewerUserId: null,
				hasImport: false,
			}),
			true,
		);
		assert.equal(
			canReadRecipeIcons({
				isCurated: false,
				shareToken: null,
				ownerUserId: "user_a",
				viewerUserId: null,
				hasImport: false,
			}),
			false,
		);
	});
});

describe("share links", () => {
	it("uses an unguessable token path and leaves the English prefix off", () => {
		const token = createShareToken();
		assert.match(token, /^[A-Za-z0-9_-]{24}$/);
		assert.equal(sharedRecipePath("en", token), `/r/${token}`);
		assert.equal(sharedRecipePath("de", token), `/de/r/${token}`);
		assert.equal(publicRecipePath("en", "recipe"), "/recipes/recipe");
		assert.equal(publicRecipePath("de", "recipe"), "/de/recipes/recipe");
	});
});

describe("clampText", () => {
	it("shortens a long title without breaking the end", () => {
		const title = clampText("  Smash   burger with a very long name  ", 16);
		assert.equal(title.endsWith("…"), true);
		assert.ok(title.length <= 16);
	});
});
