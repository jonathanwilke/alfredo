import type { Config } from "./types";

export const config = {
	appName: "alfredo",
	i18n: {
		locales: {
			de: { label: "Deutsch" },
			en: { label: "English" },
		},
		defaultLocale: "de",
		localeCookieName: "NEXT_LOCALE",
	},
	ui: {
		enabledThemes: ["light", "dark"],
		defaultTheme: "light",
	},
	auth: {
		redirectAfterSignIn: "/",
		redirectAfterLogout: "/",
		sessionCookieMaxAge: 60 * 60 * 24 * 30,
	},
} as const satisfies Config;

export type { Config };

export function getBaseUrl() {
	if (process.env.NEXT_PUBLIC_APP_URL) {
		return process.env.NEXT_PUBLIC_APP_URL;
	}

	if (process.env.VERCEL_URL) {
		return `https://${process.env.VERCEL_URL}`;
	}

	return "http://localhost:3000";
}
