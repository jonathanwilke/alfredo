import { auth } from "@repo/auth";
import { billingSnapshot, getCreditBalance } from "@repo/payments";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";

export const balance = publicProcedure
	.route({
		method: "GET",
		path: "/billing/balance",
		tags: ["Billing"],
		summary: "Recipe credit balance",
	})
	.output(
		z.object({
			authenticated: z.boolean(),
			billingEnabled: z.boolean(),
			balance: z.number().int(),
			welcomeCredits: z.number().int().nonnegative(),
			recipeCreditCost: z.number().int().positive(),
		}),
	)
	.handler(async ({ context }) => {
		const session = await auth.api.getSession({
			headers: context.headers,
		});
		if (!session) {
			return billingSnapshot({ authenticated: false, balance: 0 });
		}
		const credits = await getCreditBalance(session.user.id);
		return billingSnapshot({ authenticated: true, balance: credits });
	});
