import { getBaseUrl } from "@repo/config";
import { generateOpenApiSpec } from "./lib/openapi";
import { openApiHandler, rpcHandler } from "./orpc/handler";

export { generateOpenApiSpec } from "./lib/openapi";
export type { StoredRecipe } from "./modules/recipes/import-recipe";
export {
	ensureRecipeDescription,
	loadRecipe,
	loadSharedRecipe,
} from "./modules/recipes/import-recipe";
export { listStarterRecipes } from "./modules/recipes/starters";
export type { ApiRouterClient } from "./orpc/router";
export { router } from "./orpc/router";

function withCors(response: Response, request: Request) {
	const headers = new Headers(response.headers);
	const origin = request.headers.get("origin");
	const allowed = new Set([getBaseUrl(), "http://localhost:3000"]);

	if (origin && allowed.has(origin)) {
		headers.set("Access-Control-Allow-Origin", origin);
		headers.set("Access-Control-Allow-Credentials", "true");
		headers.set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization",
		);
		headers.set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, PATCH, DELETE, OPTIONS",
		);
		headers.set("Vary", "Origin");
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export async function handleRequest(request: Request) {
	const url = new URL(request.url);

	if (request.method === "OPTIONS") {
		return withCors(new Response(null, { status: 204 }), request);
	}

	if (url.pathname === "/api/openapi") {
		const spec = await generateOpenApiSpec();
		return withCors(Response.json(spec), request);
	}

	const isRpc =
		url.pathname === "/api/rpc" || url.pathname.startsWith("/api/rpc/");
	const handler = isRpc ? rpcHandler : openApiHandler;
	const prefix = isRpc ? "/api/rpc" : "/api";
	const { matched, response } = await handler.handle(request, {
		prefix,
		context: {
			headers: request.headers,
		},
	});

	if (matched && response) {
		return withCors(response, request);
	}

	return withCors(new Response("Not found", { status: 404 }), request);
}
