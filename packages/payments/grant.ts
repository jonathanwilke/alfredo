import { isPackId, PACK_CURRENCY } from "./config";

export type CheckoutRecord = {
	id: string;
	userId: string;
	packId: string;
	credits: number;
	priceCents: number;
	status: "pending" | "granted" | "rejected";
	paymentId: string | null;
};

export type ParsedPayment = {
	paymentId: string;
	checkoutId: string | null;
	sessionId: string | null;
	packId: string | null;
	credits: number | null;
	priceCents: number | null;
	userId: string | null;
	amountBeforeTax: number | null;
	currency: string | null;
	productId: string | null;
	customerId: string | null;
};

export type GrantDecision =
	| {
			ok: true;
			userId: string;
			credits: number;
			packId: string;
			idempotent: boolean;
	  }
	| { ok: false; reason: string; checkoutId: string | null };

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
	if (typeof value === "string" && value.trim().length > 0) {
		return value.trim();
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	return null;
}

function integerValue(value: unknown) {
	if (typeof value === "number" && Number.isInteger(value)) {
		return value;
	}
	if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
		return Number(value.trim());
	}
	return null;
}

export function amountBeforeTax(total: number | null, tax: number | null) {
	if (total == null) {
		return null;
	}
	return total - (tax ?? 0);
}

export function parseSucceededPayment(event: unknown): ParsedPayment | null {
	const body = asRecord(event);
	const data = asRecord(body?.data);
	const paymentId = stringValue(data?.payment_id);
	if (!data || !paymentId) {
		return null;
	}

	const metadata = asRecord(data.metadata);
	const customer = asRecord(data.customer);
	let productId: string | null = null;
	if (Array.isArray(data.product_cart)) {
		for (const item of data.product_cart) {
			const row = asRecord(item);
			const id = stringValue(row?.product_id);
			if (!id) {
				continue;
			}
			if (productId && productId !== id) {
				productId = "mixed";
				break;
			}
			productId = id;
			const quantity = integerValue(row?.quantity);
			if (quantity != null && quantity !== 1) {
				productId = "mixed";
				break;
			}
		}
	}

	const total = integerValue(data.total_amount);
	const tax = integerValue(data.tax);

	return {
		paymentId,
		checkoutId:
			stringValue(metadata?.checkout_id) ??
			stringValue(metadata?.checkoutId),
		sessionId: stringValue(data.checkout_session_id),
		packId: stringValue(metadata?.pack),
		credits: integerValue(metadata?.credits),
		priceCents:
			integerValue(metadata?.price_cents) ??
			integerValue(metadata?.priceCents),
		userId: stringValue(metadata?.user_id) ?? stringValue(metadata?.userId),
		amountBeforeTax: amountBeforeTax(total, tax),
		currency: stringValue(data.currency),
		productId,
		customerId:
			stringValue(customer?.customer_id) ?? stringValue(data.customer_id),
	};
}

export function decideCreditGrant(input: {
	payment: ParsedPayment;
	checkout: CheckoutRecord | null;
	productId: string;
}): GrantDecision {
	const checkout = input.checkout;
	if (!checkout) {
		return {
			ok: false,
			reason: "missing-checkout",
			checkoutId: input.payment.checkoutId,
		};
	}

	if (
		checkout.status === "granted" &&
		checkout.paymentId === input.payment.paymentId
	) {
		return {
			ok: true,
			userId: checkout.userId,
			credits: checkout.credits,
			packId: checkout.packId,
			idempotent: true,
		};
	}

	if (checkout.status !== "pending") {
		return {
			ok: false,
			reason: `checkout-${checkout.status}`,
			checkoutId: checkout.id,
		};
	}

	const payment = input.payment;
	if (
		!payment.productId ||
		payment.productId === "mixed" ||
		payment.productId !== input.productId
	) {
		return {
			ok: false,
			reason: "product-mismatch",
			checkoutId: checkout.id,
		};
	}
	if (payment.checkoutId && payment.checkoutId !== checkout.id) {
		return {
			ok: false,
			reason: "checkout-mismatch",
			checkoutId: checkout.id,
		};
	}
	if (!payment.packId || !isPackId(payment.packId)) {
		return { ok: false, reason: "unknown-pack", checkoutId: checkout.id };
	}
	if (payment.packId !== checkout.packId) {
		return { ok: false, reason: "pack-mismatch", checkoutId: checkout.id };
	}
	if (payment.credits == null || payment.credits !== checkout.credits) {
		return {
			ok: false,
			reason: "credits-mismatch",
			checkoutId: checkout.id,
		};
	}
	if (
		payment.priceCents != null &&
		payment.priceCents !== checkout.priceCents
	) {
		return { ok: false, reason: "price-mismatch", checkoutId: checkout.id };
	}
	if (!payment.userId || payment.userId !== checkout.userId) {
		return { ok: false, reason: "user-mismatch", checkoutId: checkout.id };
	}
	if (payment.currency && payment.currency !== PACK_CURRENCY) {
		return {
			ok: false,
			reason: "currency-mismatch",
			checkoutId: checkout.id,
		};
	}
	if (
		payment.amountBeforeTax == null ||
		payment.amountBeforeTax < checkout.priceCents
	) {
		return {
			ok: false,
			reason: "amount-mismatch",
			checkoutId: checkout.id,
		};
	}

	return {
		ok: true,
		userId: checkout.userId,
		credits: checkout.credits,
		packId: checkout.packId,
		idempotent: false,
	};
}
