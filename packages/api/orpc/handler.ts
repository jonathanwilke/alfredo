import { onError } from "@orpc/client";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { router } from "./router";

export const rpcHandler = new RPCHandler(router, {
	clientInterceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

export const openApiHandler = new OpenAPIHandler(router, {
	clientInterceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});
