import { createHash } from "node:crypto";

/** Stable source key so the same text, user, and language is not billed twice. */
export function textRecipeSourceUrl(
	userId: string,
	locale: string,
	text: string,
) {
	const normalized = text.trim().replace(/\s+/g, " ");
	const digest = createHash("sha256")
		.update(`${locale}\n${normalized}`)
		.digest("hex");
	return `text:${userId}:${digest}`;
}
