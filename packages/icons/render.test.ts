import assert from "node:assert/strict";
import { afterEach, before, describe, it, mock } from "node:test";
import sharp from "sharp";
import { INGREDIENT_IMAGE_CONFIG } from "./style";

type GenerateTextCall = {
	model: string;
	prompt: string;
	providerOptions?: {
		google: {
			imageConfig: {
				aspectRatio: string;
				imageSize: string;
			};
		};
	};
};

let sourcePng = new Uint8Array();

const generateText = mock.fn(async (_options: GenerateTextCall) => ({
	files: [
		{
			mediaType: "image/png",
			uint8Array: sourcePng,
		},
	],
}));

mock.module("ai", {
	namedExports: {
		generateText,
	},
});

type RenderIcon = typeof import("./render").renderIcon;

const previousMode = process.env.ICON_GENERATION_MODE;

describe("renderIcon image size", () => {
	let renderIcon: RenderIcon;

	before(async () => {
		assert.equal(INGREDIENT_IMAGE_CONFIG.imageSize, "512");
		assert.equal(INGREDIENT_IMAGE_CONFIG.aspectRatio, "1:1");
		sourcePng = new Uint8Array(
			await sharp({
				create: {
					width: 64,
					height: 48,
					channels: 3,
					background: { r: 212, g: 120, b: 74 },
				},
			})
				.png()
				.toBuffer(),
		);
		({ renderIcon } = await import("./render"));
	});

	afterEach(() => {
		generateText.mock.resetCalls();
		if (previousMode === undefined) {
			delete process.env.ICON_GENERATION_MODE;
		} else {
			process.env.ICON_GENERATION_MODE = previousMode;
		}
	});

	it("asks Gemini for a 512 square when rendering an ingredient icon", async () => {
		process.env.ICON_GENERATION_MODE = "live";

		const rendered = await renderIcon("raw tomato", "tomato", "square");
		const meta = await sharp(rendered.webp).metadata();
		const call = generateText.mock.calls[0]?.arguments[0];

		assert.equal(generateText.mock.calls.length, 1);
		assert.equal(call?.prompt, "raw tomato");
		assert.deepEqual(call?.providerOptions, {
			google: { imageConfig: INGREDIENT_IMAGE_CONFIG },
		});
		assert.equal(meta.format, "webp");
		assert.equal(meta.width, 512);
		assert.equal(meta.height, 512);
	});

	it("does not pass an image size for wide dish photos", async () => {
		process.env.ICON_GENERATION_MODE = "live";

		const rendered = await renderIcon("finished pasta", "pasta", "wide");
		const meta = await sharp(rendered.webp).metadata();
		const call = generateText.mock.calls[0]?.arguments[0];

		assert.equal(generateText.mock.calls.length, 1);
		assert.equal("providerOptions" in (call ?? {}), false);
		assert.equal(meta.format, "webp");
		assert.equal(meta.width, 1280);
		assert.equal(meta.height, 720);
	});

	it("keeps mock mode off the image model", async () => {
		process.env.ICON_GENERATION_MODE = "mock";

		const rendered = await renderIcon("raw basil", "basil", "square");
		const meta = await sharp(rendered.webp).metadata();

		assert.equal(generateText.mock.calls.length, 0);
		assert.equal(rendered.model, "mock");
		assert.equal(meta.format, "webp");
		assert.equal(meta.width, 512);
		assert.equal(meta.height, 512);
	});
});
