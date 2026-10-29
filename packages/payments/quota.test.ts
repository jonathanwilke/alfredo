import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countImportsInWindow, countsTowardQuota, resolveQuota } from "./quota";

const periodStart = new Date("2026-04-01T00:00:00.000Z");
const periodEnd = new Date("2026-05-01T00:00:00.000Z");
const now = new Date("2026-04-15T12:00:00.000Z");

describe("quota", () => {
	it("counts import and translation rows and ignores nothing else in the table", () => {
		assert.equal(countsTowardQuota("import"), true);
		assert.equal(countsTowardQuota("translation"), true);
		const used = countImportsInWindow(
			[
				{
					createdAt: new Date("2026-04-02T00:00:00.000Z"),
					type: "import",
				},
				{
					createdAt: new Date("2026-04-03T00:00:00.000Z"),
					type: "translation",
				},
				{
					createdAt: new Date("2026-03-01T00:00:00.000Z"),
					type: "import",
				},
			],
			periodStart,
			periodEnd,
		);
		assert.equal(used, 2);
	});

	it("allows one lifetime import on the free plan", () => {
		const open = resolveQuota({
			now,
			rows: [],
			subscription: null,
		});
		assert.equal(open.plan, "free");
		assert.equal(open.limit, 1);
		assert.equal(open.allowed, true);

		const used = resolveQuota({
			now,
			rows: [
				{
					createdAt: new Date("2020-01-01T00:00:00.000Z"),
					type: "import",
				},
			],
			subscription: null,
		});
		assert.equal(used.used, 1);
		assert.equal(used.allowed, false);
	});

	it("counts only the current billing period for an active subscription", () => {
		const subscription = {
			status: "active",
			currentPeriodStart: periodStart,
			currentPeriodEnd: periodEnd,
			cancelAtPeriodEnd: true,
		};
		const rows = [
			{
				createdAt: new Date("2026-03-20T00:00:00.000Z"),
				type: "import" as const,
			},
			...Array.from({ length: 29 }, () => ({
				createdAt: new Date("2026-04-10T00:00:00.000Z"),
				type: "translation" as const,
			})),
		];
		const under = resolveQuota({ now, rows, subscription });
		assert.equal(under.plan, "monthly");
		assert.equal(under.used, 29);
		assert.equal(under.limit, 30);
		assert.equal(under.allowed, true);
		assert.equal(under.cancelAtPeriodEnd, true);

		const full = resolveQuota({
			now,
			rows: [
				...rows,
				{
					createdAt: new Date("2026-04-11T00:00:00.000Z"),
					type: "import" as const,
				},
			],
			subscription,
		});
		assert.equal(full.used, 30);
		assert.equal(full.allowed, false);
	});

	it("falls back to the lifetime free import when the subscription is not active", () => {
		const snapshot = resolveQuota({
			now: new Date("2026-05-02T00:00:00.000Z"),
			rows: [
				{
					createdAt: new Date("2026-04-02T00:00:00.000Z"),
					type: "import",
				},
			],
			subscription: {
				status: "cancelled",
				currentPeriodStart: periodStart,
				currentPeriodEnd: periodEnd,
				cancelAtPeriodEnd: false,
			},
		});
		assert.equal(snapshot.plan, "free");
		assert.equal(snapshot.status, "cancelled");
		assert.equal(snapshot.allowed, false);
	});
});
