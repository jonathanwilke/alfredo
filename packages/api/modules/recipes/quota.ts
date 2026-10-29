import { z } from "zod";

export const quotaErrorData = z.object({
	used: z.number().int().nonnegative(),
	limit: z.number().int().positive(),
	plan: z.enum(["free", "monthly"]),
});

export const quotaErrors = {
	QUOTA_EXCEEDED: {
		status: 402,
		message: "Import quota exceeded",
		data: quotaErrorData,
	},
};
