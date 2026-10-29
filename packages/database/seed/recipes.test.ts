import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { curatedFixtures } from "./recipes";

describe("curated fixtures", () => {
	it("marks every fixture as operator-curated in both languages", () => {
		assert.ok(curatedFixtures.length >= 2);
		for (const fixture of curatedFixtures) {
			assert.equal(fixture.isCurated, true);
			assert.equal(fixture.source, "curated");
			assert.ok((fixture.translations.de.description ?? "").length > 0);
			assert.ok((fixture.translations.en.description ?? "").length > 0);
			assert.equal(fixture.translations.de.steps.length > 0, true);
			assert.equal(fixture.translations.en.steps.length > 0, true);
		}
	});
});
