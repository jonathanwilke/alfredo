import { randomBytes } from "node:crypto";

export function createShareToken() {
	return randomBytes(18).toString("base64url");
}

export function recipeVisibility(input: {
	isCurated: boolean;
	ownerUserId: string | null;
	viewerUserId: string | null;
	hasImport: boolean;
}) {
	if (input.isCurated) {
		return "public" as const;
	}
	if (
		input.viewerUserId &&
		(input.ownerUserId === input.viewerUserId || input.hasImport)
	) {
		return "owner" as const;
	}
	return "hidden" as const;
}

export function canReadRecipeIcons(input: {
	isCurated: boolean;
	shareToken: string | null;
	ownerUserId: string | null;
	viewerUserId: string | null;
	hasImport: boolean;
}) {
	if (input.isCurated || input.shareToken) {
		return true;
	}
	return (
		recipeVisibility({
			isCurated: false,
			ownerUserId: input.ownerUserId,
			viewerUserId: input.viewerUserId,
			hasImport: input.hasImport,
		}) === "owner"
	);
}

export function localePrefix(locale: string) {
	return locale === "de" ? "" : `/${locale}`;
}

export function publicRecipePath(locale: string, recipeId: string) {
	return `${localePrefix(locale)}/recipes/${recipeId}`;
}

export function sharedRecipePath(locale: string, token: string) {
	return `${localePrefix(locale)}/r/${token}`;
}

export function clampText(value: string, max: number) {
	const trimmed = value.trim().replace(/\s+/g, " ");
	if (trimmed.length <= max) {
		return trimmed;
	}
	return `${trimmed.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}
