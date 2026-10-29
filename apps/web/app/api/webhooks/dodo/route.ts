import { handleDodoWebhook } from "@repo/payments";

export const runtime = "nodejs";

export async function POST(request: Request) {
	const rawBody = await request.text();
	const result = await handleDodoWebhook({
		rawBody,
		headers: request.headers,
	});
	return Response.json(result.body, { status: result.status });
}
