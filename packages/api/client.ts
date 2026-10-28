import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ApiRouterClient } from "./orpc/router";

export function createApiClient(url: string) {
	const link = new RPCLink({
		url,
	});

	return createORPCClient(link) as ApiRouterClient;
}

export type { ApiRouterClient };
