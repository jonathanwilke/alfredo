import { ORPCError } from "@orpc/server";
import { getBaseUrl } from "@repo/config";
import {
	BillingDisabledError,
	CheckoutUrlMissingError,
	createCheckoutSession,
	UnknownPackError,
} from "@repo/payments";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

const localeSchema = z.enum(["de", "en"]);
const packSchema = z.enum(["pack_10", "pack_20", "pack_50"]);

export function billingReturnUrl(locale: "de" | "en", pack: string) {
	const prefix = locale === "de" ? "" : `/${locale}`;
	return `${getBaseUrl()}${prefix}/billing/return?pack=${pack}`;
}

export const createCheckout = protectedProcedure
	.route({
		method: "POST",
		path: "/billing/checkout",
		tags: ["Billing"],
		summary: "Create a Dodo Payments checkout for a credit pack",
	})
	.input(z.object({ locale: localeSchema, pack: packSchema }))
	.output(z.object({ url: z.string().url() }))
	.errors({
		BILLING_DISABLED: {
			status: 503,
			message: "Billing is not configured",
		},
		UNKNOWN_PACK: {
			status: 400,
			message: "Unknown credit pack",
		},
	})
	.handler(async ({ input, context, errors }) => {
		try {
			const url = await createCheckoutSession({
				userId: context.user.id,
				email: context.user.email,
				name: context.user.name,
				returnUrl: billingReturnUrl(input.locale, input.pack),
				pack: input.pack,
			});
			return { url };
		} catch (error) {
			if (
				error instanceof BillingDisabledError ||
				error instanceof CheckoutUrlMissingError
			) {
				throw errors.BILLING_DISABLED();
			}
			if (error instanceof UnknownPackError) {
				throw errors.UNKNOWN_PACK();
			}
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Checkout could not be created",
				cause: error,
			});
		}
	});
