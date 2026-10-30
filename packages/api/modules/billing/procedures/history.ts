import { creditUsageSummary, listCreditHistory } from "@repo/payments";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const history = protectedProcedure
	.route({
		method: "GET",
		path: "/billing/history",
		tags: ["Billing"],
		summary: "Credit purchases and usage",
	})
	.output(
		z.object({
			entries: z.array(
				z.object({
					id: z.string().uuid(),
					type: z.enum([
						"welcome",
						"purchase",
						"import",
						"refund",
						"dispute",
						"adjustment",
					]),
					amount: z.number().int(),
					createdAt: z.string().datetime(),
					packId: z.string().nullable(),
				}),
			),
			usage: z.object({
				total: z.number().int().nonnegative(),
				used: z.number().int().nonnegative(),
				remaining: z.number().int().nonnegative(),
			}),
		}),
	)
	.handler(async ({ context }) => {
		const [entries, usage] = await Promise.all([
			listCreditHistory(context.user.id),
			creditUsageSummary(context.user.id),
		]);
		return {
			entries: entries.map((entry) => ({
				...entry,
				createdAt: entry.createdAt.toISOString(),
			})),
			usage,
		};
	});
