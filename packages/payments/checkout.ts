import { creditBalances, creditCheckouts, db } from "@repo/database";
import DodoPayments from "dodopayments";
import { eq } from "drizzle-orm";
import {
	creditsProductId,
	getPaymentsConfig,
	isPackId,
	PACK_CURRENCY,
	packById,
} from "./config";

export class BillingDisabledError extends Error {
	constructor() {
		super("Billing is not configured");
		this.name = "BillingDisabledError";
	}
}

export class UnknownPackError extends Error {
	constructor() {
		super("Unknown credit pack");
		this.name = "UnknownPackError";
	}
}

export class CheckoutUrlMissingError extends Error {
	constructor() {
		super("Checkout session did not return a URL");
		this.name = "CheckoutUrlMissingError";
	}
}

function requireClient() {
	const config = getPaymentsConfig();
	if (!config.enabled || !config.environment) {
		throw new BillingDisabledError();
	}
	return {
		config,
		client: new DodoPayments({
			bearerToken: config.apiKey,
			environment: config.environment,
			...(config.webhookSecret
				? { webhookKey: config.webhookSecret }
				: {}),
		}),
	};
}

async function customerIdFor(userId: string) {
	const [row] = await db
		.select({ customerId: creditBalances.customerId })
		.from(creditBalances)
		.where(eq(creditBalances.userId, userId))
		.limit(1);
	return row?.customerId ?? null;
}

export async function createCheckoutSession(input: {
	userId: string;
	email: string;
	name: string;
	returnUrl: string;
	pack: string;
}) {
	if (!isPackId(input.pack)) {
		throw new UnknownPackError();
	}
	const pack = packById(input.pack);
	if (!pack) {
		throw new UnknownPackError();
	}
	const { client } = requireClient();
	const productId = creditsProductId();
	if (!productId) {
		throw new BillingDisabledError();
	}

	const [checkout] = await db
		.insert(creditCheckouts)
		.values({
			userId: input.userId,
			packId: pack.id,
			credits: pack.credits,
			priceCents: pack.priceCents,
			currency: PACK_CURRENCY,
			status: "pending",
		})
		.returning({ id: creditCheckouts.id });
	if (!checkout) {
		throw new CheckoutUrlMissingError();
	}

	const customerId = await customerIdFor(input.userId);
	const name = input.name.trim() || input.email;
	try {
		const session = await client.checkoutSessions.create({
			product_cart: [
				{ product_id: productId, quantity: 1, amount: pack.priceCents },
			],
			customer: customerId
				? { customer_id: customerId }
				: { email: input.email, name },
			return_url: input.returnUrl,
			metadata: {
				checkout_id: checkout.id,
				pack: pack.id,
				credits: String(pack.credits),
				user_id: input.userId,
				price_cents: String(pack.priceCents),
			},
			billing_currency: PACK_CURRENCY,
		});

		await db
			.update(creditCheckouts)
			.set({
				dodoSessionId: session.session_id,
				updatedAt: new Date(),
				...(session.checkout_url
					? {}
					: { status: "rejected", rejectReason: "missing-url" }),
			})
			.where(eq(creditCheckouts.id, checkout.id));

		if (!session.checkout_url) {
			throw new CheckoutUrlMissingError();
		}
		return session.checkout_url;
	} catch (error) {
		if (!(error instanceof CheckoutUrlMissingError)) {
			await db
				.update(creditCheckouts)
				.set({
					status: "rejected",
					rejectReason: "checkout-failed",
					updatedAt: new Date(),
				})
				.where(eq(creditCheckouts.id, checkout.id));
		}
		throw error;
	}
}
