import { listPacks, PACK_CURRENCY } from "@repo/payments";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";

const packSchema = z.object({
	id: z.enum(["pack_10", "pack_20", "pack_50"]),
	credits: z.number().int().positive(),
	priceCents: z.number().int().positive(),
	perRecipeCents: z.number().int().positive(),
	savingsCents: z.number().int().nonnegative(),
	currency: z.literal(PACK_CURRENCY),
});

export const packs = publicProcedure
	.route({
		method: "GET",
		path: "/billing/packs",
		tags: ["Billing"],
		summary: "One-time recipe credit packs",
	})
	.output(z.array(packSchema))
	.handler(async () => listPacks());
