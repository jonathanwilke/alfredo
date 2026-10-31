import { auth } from "@repo/auth";
import { toNextJsHandler } from "better-auth/next-js";

const { GET: authGET, POST: authPOST } = toNextJsHandler(auth);

function withDiscoveryCors(response: Response) {
	const headers = new Headers(response.headers);
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function discovery(request: Request) {
	return new URL(request.url).pathname.includes("/.well-known/");
}

export async function GET(request: Request) {
	const response = await authGET(request);
	return discovery(request) ? withDiscoveryCors(response) : response;
}

export async function POST(request: Request) {
	const response = await authPOST(request);
	return discovery(request) ? withDiscoveryCors(response) : response;
}

export function OPTIONS(request: Request) {
	if (!discovery(request)) {
		return new Response(null, { status: 204 });
	}
	return withDiscoveryCors(new Response(null, { status: 204 }));
}
