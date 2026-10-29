import { pathToFileURL } from "node:url";
import { iconObjectKey, normalizeIngredientKey } from "./style";

export interface CleanupIconRow {
	id: string;
	key: string;
	storageUrl: string | null;
}

export interface CleanupDuplicate {
	id: string;
	key: string;
}

export interface CleanupAction {
	iconId: string;
	fromName: string;
	canonicalKey: string;
	fromObject: string | null;
	toObject: string;
	nextUrl: string;
	copy: boolean;
	updateUrl: boolean;
	rename: boolean;
	missing: boolean;
	unrecognized: boolean;
	deleteRows: CleanupDuplicate[];
}

export interface CleanupPlan {
	actions: CleanupAction[];
	deletes: string[];
	ignored: string[];
}

export interface CleanupReport extends CleanupPlan {
	applied: boolean;
}

export function objectKeyFromStorageUrl(url: string) {
	const path = url.split(/[?#]/, 1)[0] ?? "";
	const marker = "ingredient/";
	const index = path.lastIndexOf(marker);
	if (index === -1) {
		return null;
	}

	const key = path.slice(index);
	if (
		!key.startsWith("ingredient/") ||
		!key.endsWith(".webp") ||
		key.includes("..")
	) {
		return null;
	}

	return key;
}

function referencedObject(url: string | null, objects: Set<string>) {
	if (!url) {
		return null;
	}

	const key = objectKeyFromStorageUrl(url);
	if (!key || !objects.has(key)) {
		return null;
	}

	return key;
}

/**
 * Plans a move to `ingredient/<canonicalKey>.webp`.
 * Objects outside `ingredient/` are ignored and never deleted.
 * Alias rows collapse onto the canonical key. The canonical row wins
 * when both exist; otherwise the row that has a file is kept.
 */
export function planIngredientIconCleanup(input: {
	objects: string[];
	rows: CleanupIconRow[];
	urlForKey: (key: string) => string;
}): CleanupPlan {
	const ignored = input.objects.filter(
		(key) => !key.startsWith("ingredient/"),
	);
	const ingredientObjects = input.objects.filter((key) =>
		key.startsWith("ingredient/"),
	);
	const objectSet = new Set(ingredientObjects);
	const groups = new Map<string, CleanupIconRow[]>();

	for (const row of input.rows) {
		let canonical: string;
		try {
			canonical = normalizeIngredientKey(row.key);
		} catch {
			continue;
		}

		const group = groups.get(canonical);
		if (group) {
			group.push(row);
		} else {
			groups.set(canonical, [row]);
		}
	}

	const actions: CleanupAction[] = [];
	const keep = new Set<string>();

	for (const [canonicalKey, group] of groups) {
		const survivor =
			group.find((row) => row.key === canonicalKey) ??
			group.find((row) => row.storageUrl) ??
			group[0];
		if (!survivor) {
			continue;
		}

		const duplicates = group.filter((row) => row.id !== survivor.id);
		const toObject = iconObjectKey("ingredient", canonicalKey);
		const survivorObject = referencedObject(survivor.storageUrl, objectSet);
		const duplicateObject = duplicates
			.map((row) => referencedObject(row.storageUrl, objectSet))
			.find((key): key is string => Boolean(key && key !== toObject));
		const fromObject =
			survivorObject && survivorObject !== toObject
				? survivorObject
				: (duplicateObject ?? null);
		const copy = Boolean(fromObject);
		const hasObject =
			copy || objectSet.has(toObject) || survivorObject === toObject;
		if (hasObject) {
			keep.add(toObject);
		}

		const parsed = survivor.storageUrl
			? objectKeyFromStorageUrl(survivor.storageUrl)
			: null;
		const missing = Boolean(
			survivor.storageUrl &&
				parsed &&
				!survivorObject &&
				!copy &&
				!hasObject,
		);
		const nextUrl = input.urlForKey(toObject);
		const rename = survivor.key !== canonicalKey;
		const updateUrl = hasObject && survivor.storageUrl !== nextUrl;

		actions.push({
			iconId: survivor.id,
			fromName: survivor.key,
			canonicalKey,
			fromObject,
			toObject,
			nextUrl,
			copy,
			updateUrl,
			rename,
			missing,
			unrecognized: Boolean(survivor.storageUrl) && !parsed,
			deleteRows: duplicates.map((row) => ({ id: row.id, key: row.key })),
		});
	}

	return {
		actions,
		deletes: ingredientObjects.filter((key) => !keep.has(key)),
		ignored,
	};
}

export function formatCleanupReport(report: CleanupReport) {
	const duplicateCount = report.actions.reduce(
		(sum, action) => sum + action.deleteRows.length,
		0,
	);
	const lines = [
		`Ingredient icon cleanup (${report.applied ? "apply" : "dry-run"})`,
		"recipe/ objects are not listed or deleted.",
		`Rows kept: ${report.actions.length}`,
		`Objects to delete: ${report.deletes.length}`,
		`Duplicate rows to drop: ${duplicateCount}`,
		`Ignored non-ingredient objects: ${report.ignored.length}`,
	];

	for (const action of report.actions) {
		if (action.copy && action.fromObject) {
			lines.push(`copy ${action.fromObject} -> ${action.toObject}`);
		}
		if (action.rename) {
			lines.push(`rename ${action.fromName} -> ${action.canonicalKey}`);
		}
		if (action.updateUrl) {
			lines.push(`update ${action.canonicalKey} -> ${action.nextUrl}`);
		}
		if (action.missing) {
			lines.push(
				`missing ${action.canonicalKey} referenced ${action.fromObject ?? "nothing"}`,
			);
		}
		if (action.unrecognized) {
			lines.push(`skip unrecognized url for ${action.canonicalKey}`);
		}
		for (const row of action.deleteRows) {
			lines.push(
				`${report.applied ? "dropped" : "would drop"} duplicate ${row.key} (${row.id})`,
			);
		}
	}

	for (const key of report.deletes) {
		lines.push(`${report.applied ? "deleted" : "would delete"} ${key}`);
	}

	for (const key of report.ignored) {
		lines.push(`ignored ${key}`);
	}

	if (!report.applied) {
		lines.push(
			"Dry run only. Re-run with --apply to copy, update, and delete.",
		);
	}

	return lines.join("\n");
}

export function parseCleanupArgs(argv: string[]) {
	let apply = false;
	for (const arg of argv) {
		if (arg === "--apply") {
			apply = true;
		} else if (arg === "--dry-run") {
			apply = false;
		} else {
			throw new Error(
				`Unknown argument "${arg}". Use --dry-run (default) or --apply.`,
			);
		}
	}

	return { apply };
}

export async function runIngredientIconCleanup(input: {
	apply: boolean;
	listObjects: () => Promise<string[]>;
	copyObject: (from: string, to: string) => Promise<void>;
	deleteObject: (key: string) => Promise<void>;
	urlForKey: (key: string) => string;
	loadRows: () => Promise<CleanupIconRow[]>;
	updateRow: (
		id: string,
		patch: { key: string; storageUrl?: string },
	) => Promise<void>;
	deleteRow: (id: string) => Promise<void>;
}): Promise<CleanupReport> {
	const objects = await input.listObjects();
	const rows = await input.loadRows();
	const plan = planIngredientIconCleanup({
		objects,
		rows,
		urlForKey: input.urlForKey,
	});
	if (!input.apply) {
		return { ...plan, applied: false };
	}

	for (const action of plan.actions) {
		if (action.copy && action.fromObject) {
			if (
				!action.fromObject.startsWith("ingredient/") ||
				!action.toObject.startsWith("ingredient/")
			) {
				throw new Error("Refusing to copy a non-ingredient object.");
			}
			await input.copyObject(action.fromObject, action.toObject);
		}

		if (action.rename || action.updateUrl) {
			await input.updateRow(action.iconId, {
				key: action.canonicalKey,
				...(action.copy || action.updateUrl
					? { storageUrl: action.nextUrl }
					: {}),
			});
		}

		for (const row of action.deleteRows) {
			await input.deleteRow(row.id);
		}
	}

	for (const key of plan.deletes) {
		if (!key.startsWith("ingredient/")) {
			throw new Error(
				`Refusing to delete non-ingredient object "${key}".`,
			);
		}
		await input.deleteObject(key);
	}

	return { ...plan, applied: true };
}

async function main() {
	const { apply } = parseCleanupArgs(process.argv.slice(2));
	const { and, eq } = await import("drizzle-orm");
	const { db, icons } = await import("@repo/database");
	const storage = await import("@repo/storage");

	const report = await runIngredientIconCleanup({
		apply,
		listObjects: () => storage.listIngredientObjects(),
		copyObject: (from, to) => storage.copyIngredientObject(from, to),
		deleteObject: (key) => storage.deleteIngredientObject(key),
		urlForKey: (key) => storage.publicObjectUrl(key),
		loadRows: async () =>
			db
				.select({
					id: icons.id,
					key: icons.key,
					storageUrl: icons.storageUrl,
				})
				.from(icons)
				.where(eq(icons.kind, "ingredient")),
		updateRow: async (id, patch) => {
			await db
				.update(icons)
				.set({
					key: patch.key,
					...(patch.storageUrl
						? { storageUrl: patch.storageUrl }
						: {}),
					updatedAt: new Date(),
				})
				.where(and(eq(icons.id, id), eq(icons.kind, "ingredient")));
		},
		deleteRow: async (id) => {
			await db
				.delete(icons)
				.where(and(eq(icons.id, id), eq(icons.kind, "ingredient")));
		},
	});

	console.log(formatCleanupReport(report));
}

function isDirectRun() {
	const entry = process.argv[1];
	return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
