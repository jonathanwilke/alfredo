import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";
import { ORPCError } from "@orpc/server";
import {
	ingredientSearchTerm,
	listAdminIcons,
	regenerateAdminIcon,
} from "./modules/admin/icons";
import { isAdminEmail, requireAdmin } from "./orpc/admin";

const previous = process.env.ADMIN_EMAILS;

afterEach(() => {
	if (previous === undefined) {
		delete process.env.ADMIN_EMAILS;
	} else {
		process.env.ADMIN_EMAILS = previous;
	}
});

describe("admin icons", () => {
	it("rejects emails that are not in ADMIN_EMAILS", () => {
		process.env.ADMIN_EMAILS = " Owner@Ulivo.app , other@ulivo.app ";
		assert.equal(isAdminEmail("owner@ulivo.app"), true);
		assert.equal(isAdminEmail("other@ulivo.app"), true);
		assert.equal(isAdminEmail("nope@ulivo.app"), false);
		assert.equal(isAdminEmail(null), false);
		assert.throws(
			() => requireAdmin("nope@ulivo.app"),
			(error: unknown) =>
				error instanceof ORPCError && error.code === "FORBIDDEN",
		);
		assert.doesNotThrow(() => requireAdmin("owner@ulivo.app"));

		delete process.env.ADMIN_EMAILS;
		assert.equal(isAdminEmail("owner@ulivo.app"), false);
	});

	it("does not load or schedule icons for a non-admin", async () => {
		process.env.ADMIN_EMAILS = "owner@ulivo.app";
		let loaded = false;
		let found = false;
		let scheduled = false;

		await assert.rejects(
			() =>
				listAdminIcons({
					email: "guest@ulivo.app",
					search: "pepper",
					load: async () => {
						loaded = true;
						return [];
					},
				}),
			(error: unknown) =>
				error instanceof ORPCError && error.code === "FORBIDDEN",
		);
		await assert.rejects(
			() =>
				regenerateAdminIcon({
					email: "guest@ulivo.app",
					key: "pepper",
					find: async () => {
						found = true;
						return { id: "1" };
					},
					markPending: async () => {},
					schedule: () => {
						scheduled = true;
					},
				}),
			(error: unknown) =>
				error instanceof ORPCError && error.code === "FORBIDDEN",
		);

		assert.equal(loaded, false);
		assert.equal(found, false);
		assert.equal(scheduled, false);
	});

	it("lists versioned urls and queues a known key without billing", async () => {
		process.env.ADMIN_EMAILS = "owner@ulivo.app";
		const listed = await listAdminIcons({
			email: "owner@ulivo.app",
			search: "%pepper_",
			load: async (term) => {
				assert.equal(term, "pepper");
				return [
					{
						id: "1",
						key: "black-pepper-ground",
						status: "ready",
						version: 3,
						storageUrl:
							"https://cdn.example/ingredient/black-pepper-ground.webp",
						updatedAt: new Date("2026-04-01T00:00:00.000Z"),
					},
				];
			},
		});
		assert.equal(
			listed.icons[0]?.url,
			"https://cdn.example/ingredient/black-pepper-ground.webp?v=3",
		);
		assert.equal(ingredientSearchTerm("%pepper_"), "pepper");

		let queued = "";
		const result = await regenerateAdminIcon({
			email: "owner@ulivo.app",
			key: "pepper",
			find: async (key) =>
				key === "black-pepper-ground" ? { id: "1" } : null,
			markPending: async () => {},
			schedule: (key) => {
				queued = key;
			},
		});
		assert.equal(result.queued, true);
		assert.equal(queued, "black-pepper-ground");

		await assert.rejects(
			() =>
				regenerateAdminIcon({
					email: "owner@ulivo.app",
					key: "saffron",
					find: async () => null,
					markPending: async () => {},
					schedule: () => {},
				}),
			(error: unknown) =>
				error instanceof ORPCError && error.code === "NOT_FOUND",
		);

		const procedure = readFileSync(
			new URL(
				"./modules/admin/procedures/regenerate.ts",
				import.meta.url,
			),
			"utf8",
		);
		assert.match(procedure, /adminProcedure/);
		assert.match(procedure, /regenerateIngredientIcon/);
		assert.equal(procedure.includes("@repo/payments"), false);
		assert.equal(procedure.includes("assertImportAllowed"), false);
		const list = readFileSync(
			new URL("./modules/icons/procedures/list.ts", import.meta.url),
			"utf8",
		);
		assert.match(list, /publicIconUrl/);
	});
});
