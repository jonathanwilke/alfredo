const DEFAULT_ORIGIN = "https://ulivo.app";

function stripTrailingSlash(value: string) {
	return value.replace(/\/+$/, "");
}

/** Site origin for better-auth and the OpenAPI routes under `/api`. */
export function resolveSiteOrigin(raw = process.env.EXPO_PUBLIC_API_URL) {
	const trimmed = raw?.trim();
	if (!trimmed) {
		return DEFAULT_ORIGIN;
	}
	const withoutSlash = stripTrailingSlash(trimmed);
	return withoutSlash.endsWith("/api")
		? withoutSlash.slice(0, -"/api".length)
		: withoutSlash;
}

export const siteOrigin = resolveSiteOrigin();
