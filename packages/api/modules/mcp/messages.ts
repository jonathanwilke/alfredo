import { InsufficientCreditsError } from "@repo/payments";
import { ImportError } from "../recipes/source";

export type McpLocale = "de" | "en";

const copy = {
	en: {
		invalidUrl:
			"That does not look like a link. The address needs http or https.",
		fetch_failed:
			"That page could not be read. Check the link and try again.",
		not_a_recipe: "That does not look like a recipe.",
		extract_failed:
			"The guide could not be created. Try again in a moment.",
		not_configured: "Recipe extraction is not set up yet.",
		account_required: "Sign in to ulivo first.",
		textTooShort: "Pass the full recipe: title, ingredients, and steps.",
		notFound: "That recipe is not on this account.",
		invalidRecipe: "Pass a ulivo recipe id or a ulivo.app recipe URL.",
		invalidCursor: "That page cursor is not valid.",
		credits: (balance: number) =>
			`This needs 1 credit. You have ${balance} left.`,
	},
	de: {
		invalidUrl:
			"Das sieht nicht nach einem Link aus. Die Adresse braucht http oder https.",
		fetch_failed:
			"Die Seite ließ sich nicht lesen. Prüf den Link und versuch es noch einmal.",
		not_a_recipe: "Das sieht nicht nach einem Rezept aus.",
		extract_failed:
			"Die Anleitung konnte nicht erstellt werden. Versuch es gleich noch einmal.",
		not_configured: "Die Rezept-Erkennung ist noch nicht eingerichtet.",
		account_required: "Melde dich zuerst bei ulivo an.",
		textTooShort: "Schick das ganze Rezept: Titel, Zutaten und Schritte.",
		notFound: "Dieses Rezept liegt nicht auf diesem Konto.",
		invalidRecipe:
			"Gib eine ulivo-Rezept-Id oder eine ulivo.app-Rezeptadresse an.",
		invalidCursor: "Dieser Seitenzeiger ist ungültig.",
		credits: (balance: number) =>
			`Dafür brauchst du 1 Guthaben. Du hast noch ${balance}.`,
	},
} as const;

export function mcpMessages(locale: McpLocale) {
	return copy[locale];
}

export function mcpLocale(
	value: string | null | undefined,
	fallback: McpLocale = "en",
): McpLocale {
	if (value === "de" || value === "en") {
		return value;
	}
	const tag = value?.toLowerCase().match(/[a-z]{2}/)?.[0];
	if (tag === "de") {
		return "de";
	}
	return fallback;
}

export function importFailureMessage(locale: McpLocale, error: unknown) {
	const messages = mcpMessages(locale);
	if (error instanceof InsufficientCreditsError) {
		return messages.credits(error.balance);
	}
	if (error instanceof ImportError) {
		return messages[error.reason];
	}
	return messages.extract_failed;
}
