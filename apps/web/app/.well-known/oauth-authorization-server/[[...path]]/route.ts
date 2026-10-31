import { auth } from "@repo/auth";

export const dynamic = "force-dynamic";

function withDiscoveryCors(response: Response) {
	const headers = new Headers(response.headers);
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
	headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

async function handle(request: Request) {
	if (request.method === "OPTIONS") {
		return withDiscoveryCors(new Response(null, { status: 204 }));
	}
	return withDiscoveryCors(await auth.handler(request));
}

export const GET = handle;
export const HEAD = handle;
export const OPTIONS = handle;
