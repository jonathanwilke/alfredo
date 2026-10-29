import { creditBalances, db } from "@repo/database";
import DodoPayments from "dodopayments";
import { eq } from "drizzle-orm";
import {
	getPaymentsConfig,
	isPackId,
	PACK_CURRENCY,
	type PackId,
	packProductId,
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
	const pack: PackId = input.pack;
	const { client } = requireClient();
	const productId = packProductId(pack);
	if (!productId) {
		throw new BillingDisabledError();
	}

	const customerId = await customerIdFor(input.userId);
	const name = input.name.trim() || input.email;
	const session = await client.checkoutSessions.create({
		product_cart: [{ product_id: productId, quantity: 1 }],
		customer: customerId
			? { customer_id: customerId }
			: { email: input.email, name },
		return_url: input.returnUrl,
		metadata: { user_id: input.userId, pack },
		billing_currency: PACK_CURRENCY,
	});

	if (!session.checkout_url) {
		throw new CheckoutUrlMissingError();
	}
	return session.checkout_url;
}
