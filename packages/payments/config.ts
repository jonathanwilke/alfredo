export type DodoEnvironment = "test_mode" | "live_mode";

export type PaymentsConfig = {
	apiKey: string;
	webhookSecret: string;
	productId: string;
	environment: DodoEnvironment | null;
	enabled: boolean;
};

function clean(value: string | undefined) {
	const trimmed = value?.trim() ?? "";
	return trimmed.length > 0 ? trimmed : "";
}

function parseEnvironment(value: string | undefined): DodoEnvironment | null {
	const trimmed = value?.trim();
	if (trimmed === "test_mode" || trimmed === "live_mode") {
		return trimmed;
	}
	return null;
}

export function getPaymentsConfig(): PaymentsConfig {
	const apiKey = clean(process.env.DODO_PAYMENTS_API_KEY);
	const webhookSecret = clean(process.env.DODO_PAYMENTS_WEBHOOK_SECRET);
	const productId = clean(process.env.DODO_PAYMENTS_PRODUCT_ID);
	const environment = parseEnvironment(process.env.DODO_PAYMENTS_ENVIRONMENT);

	return {
		apiKey,
		webhookSecret,
		productId,
		environment,
		enabled: Boolean(apiKey && productId && environment),
	};
}
