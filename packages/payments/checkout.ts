import { db, subscriptions } from "@repo/database";
import DodoPayments from "dodopayments";
import { desc, eq } from "drizzle-orm";
import { getPaymentsConfig } from "./config";

export class BillingDisabledError extends Error {
	constructor() {
		super("Billing is not configured");
		this.name = "BillingDisabledError";
	}
}

export class NoCustomerError extends Error {
	constructor() {
		super("No billing customer");
		this.name = "NoCustomerError";
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

async function latestCustomerId(userId: string) {
	const [row] = await db
		.select({ customerId: subscriptions.customerId })
		.from(subscriptions)
		.where(eq(subscriptions.userId, userId))
		.orderBy(desc(subscriptions.updatedAt))
		.limit(1);
	return row?.customerId ?? null;
}

export async function createCheckoutSession(input: {
	userId: string;
	email: string;
	name: string;
	returnUrl: string;
}) {
	const { client, config } = requireClient();
	const customerId = await latestCustomerId(input.userId);
	const name = input.name.trim() || input.email;
	const session = await client.checkoutSessions.create({
		product_cart: [{ product_id: config.productId, quantity: 1 }],
		customer: customerId
			? { customer_id: customerId }
			: { email: input.email, name },
		return_url: input.returnUrl,
		metadata: { user_id: input.userId },
	});

	if (!session.checkout_url) {
		throw new CheckoutUrlMissingError();
	}
	return session.checkout_url;
}

export async function createPortalSession(input: {
	userId: string;
	returnUrl: string;
}) {
	const { client } = requireClient();
	const customerId = await latestCustomerId(input.userId);
	if (!customerId) {
		throw new NoCustomerError();
	}
	const session = await client.customers.customerPortal.create(customerId, {
		return_url: input.returnUrl,
		send_email: false,
	});
	return session.link;
}
