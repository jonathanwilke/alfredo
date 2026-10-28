import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";

export const health = publicProcedure
	.route({
		method: "GET",
		path: "/health",
		tags: ["System"],
		summary: "Health check",
	})
	.output(
		z.object({
			status: z.literal("ok"),
		}),
	)
	.handler(() => {
		return { status: "ok" as const };
	});
