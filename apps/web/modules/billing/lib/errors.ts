import { ORPCError } from "@orpc/client";

export function orpcCode(error: unknown) {
	return error instanceof ORPCError ? error.code : null;
}
