import { ORPCError } from "@orpc/server";
import { normalizeIngredientKey, publicIconUrl } from "@repo/icons/style";
import { requireAdmin } from "../../orpc/admin";

export interface AdminIconRow {
	id: string;
	key: string;
	status: "pending" | "ready" | "failed";
	version: number;
	storageUrl: string | null;
	updatedAt: Date;
}

export function ingredientSearchTerm(search: string) {
	return search.trim().replace(/[%_\\]/g, "");
}

export async function listAdminIcons(input: {
	email: string | null | undefined;
	search: string;
	load: (term: string) => Promise<AdminIconRow[]>;
}) {
	requireAdmin(input.email);
	const rows = await input.load(ingredientSearchTerm(input.search));
	return {
		icons: rows.map((row) => ({
			id: row.id,
			key: row.key,
			status: row.status,
			version: row.version,
			url: publicIconUrl(row.storageUrl, row.version, "ingredient"),
			updatedAt: row.updatedAt.toISOString(),
		})),
	};
}

/**
 * Queues one ingredient overwrite. Callers must not record an import
 * or check quota; the background render only writes the icon row.
 */
export async function regenerateAdminIcon(input: {
	email: string | null | undefined;
	key: string;
	find: (key: string) => Promise<{ id: string } | null>;
	markPending: (id: string) => Promise<void>;
	schedule: (key: string) => void;
}) {
	requireAdmin(input.email);
	const key = normalizeIngredientKey(input.key);
	const row = await input.find(key);
	if (!row) {
		throw new ORPCError("NOT_FOUND", {
			message: `Unknown ingredient icon "${key}".`,
		});
	}

	await input.markPending(row.id);
	input.schedule(key);
	return { key, queued: true as const };
}
