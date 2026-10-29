import { pathToFileURL } from "node:url";
import {
	buildIngredientPrompt,
	iconObjectKey,
	ingredientSubject,
	nextIngredientVersion,
	normalizeIngredientKey,
} from "./style";

export class UnknownIngredientIconError extends Error {
	constructor(key: string) {
		super(`Unknown ingredient icon "${key}". Pass --create to add it.`);
		this.name = "UnknownIngredientIconError";
	}
}

export interface IngredientIconRecord {
	id: string;
	key: string;
	version: number;
	storageUrl: string | null;
	prompt: string;
	status: "pending" | "ready" | "failed";
}

export interface RegenerateDeps {
	find(key: string): Promise<IngredientIconRecord | null>;
	insert(input: {
		key: string;
		prompt: string;
	}): Promise<IngredientIconRecord>;
	save(
		id: string,
		patch: Partial<
			Pick<
				IngredientIconRecord,
				"status" | "storageUrl" | "version" | "prompt"
			>
		> & { model?: string },
	): Promise<void>;
	render(
		prompt: string,
		label: string,
	): Promise<{ webp: Uint8Array; model: string; prompt: string }>;
	put(key: string, body: Uint8Array): Promise<{ url: string }>;
}

/**
 * Re-renders one ingredient icon onto `ingredient/<canonicalKey>.webp`.
 * Does not write an imports row and does not check quota.
 */
export async function regenerateIngredientIcon(input: {
	key: string;
	promptExtra?: string;
	create?: boolean;
	deps?: RegenerateDeps;
}) {
	const key = normalizeIngredientKey(input.key);
	const deps = input.deps ?? (await defaultDeps());
	const prompt = buildIngredientPrompt(key, input.promptExtra);
	let row = await deps.find(key);
	if (!row) {
		if (!input.create) {
			throw new UnknownIngredientIconError(key);
		}
		row = await deps.insert({ key, prompt });
	}

	const objectKey = iconObjectKey("ingredient", key);
	try {
		const rendered = await deps.render(prompt, ingredientSubject(key));
		const stored = await deps.put(objectKey, rendered.webp);
		const version = nextIngredientVersion(row);
		await deps.save(row.id, {
			status: "ready",
			storageUrl: stored.url,
			version,
			prompt: rendered.prompt,
			model: rendered.model,
		});
		return { key, objectKey, version, url: stored.url };
	} catch (error) {
		try {
			await deps.save(row.id, { status: "failed" });
		} catch (saveError) {
			console.error(saveError);
		}
		throw error;
	}
}

async function defaultDeps(): Promise<RegenerateDeps> {
	const { and, eq } = await import("drizzle-orm");
	const { db, icons } = await import("@repo/database");
	const { putPublicObject } = await import("@repo/storage");
	const { renderIcon } = await import("./render");
	const { imageModelId } = await import("./style");

	function toRecord(row: {
		id: string;
		key: string;
		version: number;
		storageUrl: string | null;
		prompt: string;
		status: "pending" | "ready" | "failed";
	}): IngredientIconRecord {
		return {
			id: row.id,
			key: row.key,
			version: row.version,
			storageUrl: row.storageUrl,
			prompt: row.prompt,
			status: row.status,
		};
	}

	return {
		async find(key) {
			const row = await db.query.icons.findFirst({
				where: and(eq(icons.kind, "ingredient"), eq(icons.key, key)),
			});
			return row ? toRecord(row) : null;
		},
		async insert(input) {
			const [created] = await db
				.insert(icons)
				.values({
					kind: "ingredient",
					key: input.key,
					recipeId: null,
					prompt: input.prompt,
					model: imageModelId(),
					status: "pending",
				})
				.onConflictDoNothing({ target: [icons.kind, icons.key] })
				.returning();
			if (created) {
				return toRecord(created);
			}

			const raced = await db.query.icons.findFirst({
				where: and(
					eq(icons.kind, "ingredient"),
					eq(icons.key, input.key),
				),
			});
			if (!raced) {
				throw new Error("Icon row was not created.");
			}
			return toRecord(raced);
		},
		async save(id, patch) {
			await db
				.update(icons)
				.set({
					...patch,
					updatedAt: new Date(),
				})
				.where(eq(icons.id, id));
		},
		async render(prompt, label) {
			return renderIcon(prompt, label, "square");
		},
		async put(key, body) {
			return putPublicObject({
				key,
				body,
				contentType: "image/webp",
			});
		},
	};
}

export function parseRegenerateArgs(argv: string[]) {
	let key: string | undefined;
	let promptExtra: string | undefined;
	let create = false;

	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index];
		if (!arg) {
			continue;
		}
		if (arg === "--create") {
			create = true;
			continue;
		}
		if (arg === "--prompt-extra") {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				throw new Error("--prompt-extra needs a value.");
			}
			promptExtra = value;
			index += 1;
			continue;
		}
		if (arg.startsWith("--")) {
			throw new Error(`Unknown argument "${arg}".`);
		}
		if (key) {
			throw new Error("Expected one canonical key.");
		}
		key = arg;
	}

	if (!key) {
		throw new Error(
			'Usage: pnpm icons:regenerate <canonicalKey> [--prompt-extra "..."] [--create]',
		);
	}

	return { key, promptExtra, create };
}

async function main() {
	try {
		const args = parseRegenerateArgs(process.argv.slice(2));
		const result = await regenerateIngredientIcon(args);
		console.log(
			`Regenerated ${result.key} -> ${result.objectKey} (v${result.version})`,
		);
	} catch (error) {
		if (error instanceof UnknownIngredientIconError) {
			console.error(error.message);
		} else {
			console.error(error instanceof Error ? error.message : error);
		}
		process.exitCode = 1;
	}
}

function isDirectRun() {
	const entry = process.argv[1];
	return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
	void main();
}
