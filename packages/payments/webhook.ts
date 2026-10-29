import { billingEvents, db, subscriptions, user } from "@repo/database";
import { eq, isNull, lte, or, sql } from "drizzle-orm";
import { getPaymentsConfig } from "./config";
import {
	processVerifiedWebhook,
	type SubscriptionPatch,
	type WebhookStore,
} from "./events";
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
		async findUserIdBySubscription(subscriptionId) {
			const [row] = await tx
				.select({ userId: subscriptions.userId })
				.from(subscriptions)
				.where(eq(subscriptions.subscriptionId, subscriptionId))
				.limit(1);
			return row?.userId ?? null;
		},
		async findUserIdByCustomer(customerId) {
			const [row] = await tx
				.select({ userId: subscriptions.userId })
				.from(subscriptions)
				.where(eq(subscriptions.customerId, customerId))
				.limit(1);
			return row?.userId ?? null;
		},
		async getLastEventAt(subscriptionId) {
			const [row] = await tx
				.select({ lastEventAt: subscriptions.lastEventAt })
				.from(subscriptions)
				.where(eq(subscriptions.subscriptionId, subscriptionId))
				.limit(1);
			return row?.lastEventAt ?? null;
		},
		async upsert(patch) {
			await upsertSubscription(tx, patch);
		},
	};
}

async function upsertSubscription(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	patch: SubscriptionPatch & { userId: string },
) {
	const values = {
		userId: patch.userId,
		customerId: patch.customerId,
		subscriptionId: patch.subscriptionId,
		productId: patch.productId,
		status: patch.status,
		currentPeriodStart: patch.currentPeriodStart,
		currentPeriodEnd: patch.currentPeriodEnd,
		cancelAtPeriodEnd: patch.cancelAtPeriodEnd,
		lastEventAt: patch.eventAt,
		updatedAt: new Date(),
	};
	await tx
		.insert(subscriptions)
		.values(values)
		.onConflictDoUpdate({
			target: subscriptions.subscriptionId,
			set: values,
			setWhere: or(
				isNull(subscriptions.lastEventAt),
				lte(subscriptions.lastEventAt, patch.eventAt),
			),
		});
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
