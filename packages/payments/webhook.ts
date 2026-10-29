import {
	billingEvents,
	creditBalances,
	creditCheckouts,
	db,
	user,
} from "@repo/database";
import { eq, sql } from "drizzle-orm";
import { getPaymentsConfig } from "./config";
import { processVerifiedWebhook, type WebhookStore } from "./events";
import type { CheckoutRecord } from "./grant";
import { creditStore } from "./service";
import { verifyWebhook } from "./verify";

export type WebhookResult = {
	status: number;
	body: { received: boolean; duplicate?: boolean };
};

function header(headers: Headers, name: string) {
	return headers.get(name) ?? headers.get(name.toLowerCase()) ?? "";
}

function createStore(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): WebhookStore {
	return {
		credits: creditStore(tx),
		async claim(id, type) {
			const inserted = await tx
				.insert(billingEvents)
				.values({ id, type })
				.onConflictDoNothing()
				.returning({ id: billingEvents.id });
			return inserted.length > 0;
		},
		async release(id) {
			await tx.delete(billingEvents).where(eq(billingEvents.id, id));
		},
		async findUserIdByEmail(email) {
			const [row] = await tx
				.select({ id: user.id })
				.from(user)
				.where(sql`lower(${user.email}) = ${email.toLowerCase()}`)
				.limit(1);
			return row?.id ?? null;
		},
		async findUserIdByCustomer(customerId) {
			const [row] = await tx
				.select({ userId: creditBalances.userId })
				.from(creditBalances)
				.where(eq(creditBalances.customerId, customerId))
				.limit(1);
			return row?.userId ?? null;
		},
		async rememberCustomer(userId, customerId) {
			await tx
				.insert(creditBalances)
				.values({ userId, balance: 0, customerId })
				.onConflictDoUpdate({
					target: creditBalances.userId,
					set: { customerId, updatedAt: new Date() },
				});
		},
		async findCheckoutById(id) {
			const [row] = await tx
				.select()
				.from(creditCheckouts)
				.where(eq(creditCheckouts.id, id))
				.limit(1);
			return row ? toCheckout(row) : null;
		},
		async findCheckoutBySession(sessionId) {
			const [row] = await tx
				.select()
				.from(creditCheckouts)
				.where(eq(creditCheckouts.dodoSessionId, sessionId))
				.limit(1);
			return row ? toCheckout(row) : null;
		},
		async flagCheckout(id, input) {
			await tx
				.update(creditCheckouts)
				.set({
					status: input.status,
					paymentId: input.paymentId,
					rejectReason: input.reason,
					updatedAt: new Date(),
				})
				.where(eq(creditCheckouts.id, id));
		},
	};
}

function toCheckout(
	row: typeof creditCheckouts.$inferSelect,
): CheckoutRecord | null {
	if (
		row.status !== "pending" &&
		row.status !== "granted" &&
		row.status !== "rejected"
	) {
		return null;
	}
	return {
		id: row.id,
		userId: row.userId,
		packId: row.packId,
		credits: row.credits,
		priceCents: row.priceCents,
		status: row.status,
		paymentId: row.paymentId,
	};
}

export async function handleDodoWebhook(input: {
	rawBody: string;
	headers: Headers;
}): Promise<WebhookResult> {
	const config = getPaymentsConfig();
	if (!config.webhookSecret) {
		return { status: 503, body: { received: false } };
	}

	const webhookId = header(input.headers, "webhook-id");
	const signature = header(input.headers, "webhook-signature");
	const timestamp = header(input.headers, "webhook-timestamp");
	if (!webhookId || !signature || !timestamp) {
		return { status: 400, body: { received: false } };
	}

	let event: unknown;
	try {
		event = verifyWebhook(
			input.rawBody,
			{
				"webhook-id": webhookId,
				"webhook-signature": signature,
				"webhook-timestamp": timestamp,
			},
			config.webhookSecret,
		);
	} catch {
		return { status: 401, body: { received: false } };
	}

	try {
		const outcome = await db.transaction(async (tx) => {
			return processVerifiedWebhook(
				{ webhookId, event },
				createStore(tx),
			);
		});
		return {
			status: 200,
			body: { received: true, duplicate: outcome === "duplicate" },
		};
	} catch (error) {
		console.error(
			"[billing] webhook failed",
			error instanceof Error ? error.message : "unknown error",
		);
		return { status: 500, body: { received: false } };
	}
}
