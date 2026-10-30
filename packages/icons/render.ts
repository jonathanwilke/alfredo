import { generateText } from "ai";
import sharp from "sharp";
import {
	type DishPromptIngredient,
	INGREDIENT_IMAGE_CONFIG,
	iconPrompt,
	imageModelId,
	ingredientIconPrompt,
	shouldMockIconGeneration,
} from "./style";

const CLAY = ["#E7B48A", "#F2C1A0", "#D4E28D", "#C96B4A", "#F4D35E", "#8FBF9F"];

function mockSvg(label: string, width: number, height: number) {
	const hue = [...label].reduce((sum, char) => sum + char.charCodeAt(0), 0);
	const fill = CLAY[hue % CLAY.length];
	const cx = width / 2;
	const cy = height / 2;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
		<rect width="${width}" height="${height}" fill="#F3EDE3"/>
		<ellipse cx="${cx}" cy="${cy + 120}" rx="140" ry="28" fill="#E4D9C8"/>
		<circle cx="${cx}" cy="${cy}" r="118" fill="${fill}"/>
		<ellipse cx="${cx - 42}" cy="${cy - 38}" rx="36" ry="18" fill="#fff6ea" opacity="0.55"/>
	</svg>`;
}

async function toWebp(
	input: Buffer,
	width: number,
	height: number,
	quality = 80,
) {
	return sharp(input)
		.resize(width, height, {
			fit: "cover",
			position: "centre",
			background: { r: 243, g: 237, b: 227, alpha: 1 },
		})
		.webp({ quality })
		.toBuffer();
}

export async function renderIcon(
	prompt: string,
	mockLabel: string,
	frame: "square" | "wide" = "square",
) {
	const width = frame === "wide" ? 1280 : 512;
	const height = frame === "wide" ? 720 : 512;
	const model = shouldMockIconGeneration() ? "mock" : imageModelId();

	if (model === "mock") {
		const webp = await toWebp(
			Buffer.from(mockSvg(mockLabel, width, height)),
			width,
			height,
			frame === "wide" ? 90 : 80,
		);
		return { webp, model, prompt };
	}

	const result = await generateText({
		model,
		prompt,
		...(frame === "square"
			? {
					providerOptions: {
						google: {
							imageConfig: INGREDIENT_IMAGE_CONFIG,
						},
					},
				}
			: {}),
	});
	const file = result.files.find((item) =>
		item.mediaType.startsWith("image/"),
	);

	if (!file) {
		throw new Error("The image model did not return a file.");
	}

	const webp = await toWebp(
		Buffer.from(file.uint8Array),
		width,
		height,
		frame === "wide" ? 90 : 80,
	);
	return { webp, model, prompt };
}

export function subjectPrompt(
	subject: string,
	kind: "ingredient" | "recipe" = "recipe",
	ingredients: DishPromptIngredient[] = [],
) {
	if (kind === "ingredient") {
		return ingredientIconPrompt(subject);
	}

	return iconPrompt({ title: subject, ingredients });
}
