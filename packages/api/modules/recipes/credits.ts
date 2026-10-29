import { z } from "zod";

export const creditErrors = {
	INSUFFICIENT_CREDITS: {
		status: 402,
		message: "Not enough recipe credits",
		data: z.object({
			balance: z.number().int(),
		}),
	},
};
