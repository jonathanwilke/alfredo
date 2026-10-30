export function oneParam(value: string | string[] | undefined) {
	const raw = Array.isArray(value) ? value[0] : value;
	return raw?.trim() ? raw : null;
}

export function safeNext(value: string | null) {
	if (
		!value?.startsWith("/") ||
		value.startsWith("//") ||
		value.startsWith("/login")
	) {
		return "/";
	}
	return value;
}

export function recipeUrlFromImport(value: string | null) {
	if (!value) {
		return null;
	}
	try {
		const parsed = new URL(value);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}
		return parsed.href;
	} catch {
		return null;
	}
}
