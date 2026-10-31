import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sourceCredit } from "./source-credit";

describe("sourceCredit", () => {
	it("uses the site domain and keeps the original link", () => {
		assert.deepEqual(
			sourceCredit("https://www.chefkoch.de/rezepte/123/Carbonara.html"),
			{
				href: "https://www.chefkoch.de/rezepte/123/Carbonara.html",
				label: "chefkoch.de",
			},
		);
	});

	it("uses a social handle when the URL includes one", () => {
		assert.equal(
			sourceCredit("https://www.tiktok.com/@pastaqueen/video/1")?.label,
			"@pastaqueen",
		);
		assert.equal(
			sourceCredit("https://www.instagram.com/pastaqueen/reel/abc")
				?.label,
			"@pastaqueen",
		);
		assert.equal(
			sourceCredit("https://www.youtube.com/@kenji/videos")?.label,
			"@kenji",
		);
		assert.equal(
			sourceCredit("https://www.instagram.com/reel/abc")?.label,
			"instagram.com",
		);
		assert.equal(sourceCredit("https://youtu.be/abc")?.label, "youtu.be");
	});

	it("hides internal and empty addresses", () => {
		assert.equal(sourceCredit("ulivo-copy://user/recipe"), null);
		assert.equal(sourceCredit(""), null);
		assert.equal(sourceCredit(null), null);
	});
});
