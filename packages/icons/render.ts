import { generateText } from "ai";
import sharp from "sharp";
import { iconPrompt, imageModelId, shouldMockIconGeneration } from "./style";

const CLAY = ["#E7B48A", "#F2C1A0", "#D4E28D", "#C96B4A", "#F4D35E", "#8FBF9F"];

function mockSvg(label: string) {
	const hue = [...label].reduce((sum, char) => sum + char.charCodeAt(0), 0);
	const fill = CLAY[hue % CLAY.length];
	return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
		<rect width="512" height="512" fill="#F3EDE3"/>
		<ellipse cx="256" cy="360" rx="108" ry="28" fill="#E4D9C8"/>
		<circle cx="256" cy="236" r="118" fill="${fill}"/>
		<ellipse cx="214" cy="198" rx="36" ry="18" fill="#fff6ea" opacity="0.55"/>
	</svg>`;
}

async function toWebp(input: Buffer) {
	return sharp(input)
		.resize(512, 512, {
			fit: "contain",
			background: { r: 243, g: 237, b: 227, alpha: 1 },
		})
		.webp({ quality: 80 })
		.toBuffer();
}

export async function renderIcon(prompt: string, mockLabel: string) {
	const model = shouldMockIconGeneration() ? "mock" : imageModelId();

	if (model === "mock") {
		const webp = await toWebp(Buffer.from(mockSvg(mockLabel)));
		return { webp, model, prompt };
	}

	const result = await generateText({
		model,
		prompt,
	});
	const file = result.files.find((item) =>
		item.mediaType.startsWith("image/"),
	);

	if (!file) {
		throw new Error("The image model did not return a file.");
	}

	const webp = await toWebp(Buffer.from(file.uint8Array));
	return { webp, model, prompt };
}

export function subjectPrompt(subject: string) {
	return iconPrompt(subject);
}
