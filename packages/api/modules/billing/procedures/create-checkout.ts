import { ORPCError } from "@orpc/server";
import { getBaseUrl } from "@repo/config";
import { BillingDisabledError, createCheckoutSession } from "@repo/payments";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

const localeSchema = z.enum(["de", "en"]);

export function billingReturnUrl(locale: "de" | "en") {
	const prefix = locale === "de" ? "" : `/${locale}`;
	return `${getBaseUrl()}${prefix}/billing/return`;
}

export const createCheckout = protectedProcedure
	.route({
		method: "POST",
		path: "/billing/checkout",
		tags: ["Billing"],
		summary: "Create a Dodo Payments checkout session",
	})
	.input(z.object({ locale: localeSchema }))
	.output(z.object({ url: z.string().url() }))
	.errors({
		BILLING_DISABLED: {
			status: 503,
			message: "Billing is not configured",
		},
	})
	.handler(async ({ input, context, errors }) => {
		try {
			const url = await createCheckoutSession({
				userId: context.user.id,
				email: context.user.email,
				name: context.user.name,
				returnUrl: billingReturnUrl(input.locale),
			});
			return { url };
		} catch (error) {
			if (error instanceof BillingDisabledError) {
				throw errors.BILLING_DISABLED();
			}
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Checkout could not be created",
				cause: error,
			});
		}
	});
