import { Webhook } from "standardwebhooks";

export type WebhookSignatureHeaders = {
	"webhook-id": string;
	"webhook-signature": string;
	"webhook-timestamp": string;
};

export function verifyWebhook(
	rawBody: string,
	headers: WebhookSignatureHeaders,
	secret: string,
) {
	const webhook = new Webhook(secret);
	webhook.verify(rawBody, headers);
	return JSON.parse(rawBody) as unknown;
}
