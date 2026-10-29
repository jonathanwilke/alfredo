import { auth } from "@repo/auth";
import { getBillingStatus, getPaymentsConfig } from "@repo/payments";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";

const statusSchema = z.object({
	billingEnabled: z.boolean(),
	authenticated: z.boolean(),
	plan: z.enum(["free", "monthly"]),
	status: z.string().nullable(),
	cancelAtPeriodEnd: z.boolean(),
	periodStart: z.string().datetime().nullable(),
	periodEnd: z.string().datetime().nullable(),
	used: z.number().int().nonnegative(),
	limit: z.number().int().positive(),
	allowed: z.boolean(),
	hasCustomer: z.boolean(),
	monthlyLimit: z.number().int().positive(),
	priceCents: z.number().int().positive(),
	currency: z.enum(["USD", "EUR"]),
	interval: z.literal("month"),
});

function iso(value: Date | null) {
	return value ? value.toISOString() : null;
}

export const status = publicProcedure
	.route({
		method: "GET",
		path: "/billing/status",
		tags: ["Billing"],
		summary: "Plan, billing period, and import quota",
	})
	.input(z.object({ locale: z.enum(["de", "en"]) }))
	.output(statusSchema)
	.handler(async ({ context, input }) => {
		const session = await auth.api.getSession({
			headers: context.headers,
		});
		const billing = await getBillingStatus({
			userId: session?.user.id ?? null,
			billingEnabled: getPaymentsConfig().enabled,
			locale: input.locale,
		});
		return {
			...billing,
			periodStart: iso(billing.periodStart),
			periodEnd: iso(billing.periodEnd),
		};
	});
