import { requireMcpAuth } from "@better-auth/mcp";
import { resolveToolLocale } from "@repo/api";
import { auth } from "@repo/auth";
import { mcpResourceUrl } from "@repo/config";
import { ulivoMcpHandler } from "../../../modules/mcp/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function withMcpCors(response: Response) {
	const headers = new Headers(response.headers);
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
	headers.set(
		"Access-Control-Allow-Headers",
		"Authorization, Content-Type, MCP-Protocol-Version, Last-Event-ID",
	);
	headers.set("Access-Control-Expose-Headers", "WWW-Authenticate");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export function OPTIONS() {
	return withMcpCors(new Response(null, { status: 204 }));
}

export async function POST(request: Request) {
	const locale = resolveToolLocale(
		undefined,
		request.headers.get("accept-language"),
	);
	const resource = mcpResourceUrl();
	const handler = requireMcpAuth(
		auth,
		async (incoming, claims) => {
			const userId = typeof claims.sub === "string" ? claims.sub : "";
			if (!userId) {
				return new Response(
					JSON.stringify({
						jsonrpc: "2.0",
						error: { code: -32001, message: "Unauthorized" },
						id: null,
					}),
					{
						status: 401,
						headers: { "content-type": "application/json" },
					},
				);
			}
			return ulivoMcpHandler({ userId, locale }).fetch(incoming);
		},
		{ resource },
	);
	return withMcpCors(await handler(request));
}
