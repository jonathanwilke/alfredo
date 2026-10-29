import { ORPCError } from "@orpc/server";
import { getBaseUrl } from "@repo/config";
import {
	BillingDisabledError,
	createPortalSession,
	NoCustomerError,
} from "@repo/payments";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const portal = protectedProcedure
	.route({
		method: "POST",
		path: "/billing/portal",
		tags: ["Billing"],
		summary: "Open the Dodo customer portal",
	})
	.input(z.object({ locale: z.enum(["de", "en"]) }))
	.output(z.object({ url: z.string().url() }))
	.errors({
		BILLING_DISABLED: {
			status: 503,
			message: "Billing is not configured",
		},
		NO_CUSTOMER: {
			status: 409,
			message: "No billing customer",
		},
	})
	.handler(async ({ input, context, errors }) => {
		const prefix = input.locale === "de" ? "" : `/${input.locale}`;
		try {
			const url = await createPortalSession({
				userId: context.user.id,
				returnUrl: `${getBaseUrl()}${prefix}/`,
			});
			return { url };
		} catch (error) {
			if (error instanceof BillingDisabledError) {
				throw errors.BILLING_DISABLED();
			}
			if (error instanceof NoCustomerError) {
				throw errors.NO_CUSTOMER();
			}
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Customer portal could not be opened",
				cause: error,
			});
		}
	});
