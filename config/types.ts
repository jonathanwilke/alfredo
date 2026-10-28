export interface Config {
	appName: string;
	i18n: {
		locales: Record<string, { label: string }>;
		defaultLocale: string;
		localeCookieName: string;
	};
	ui: {
		enabledThemes: string[];
		defaultTheme: string;
	};
	auth: {
		redirectAfterSignIn: string;
		redirectAfterLogout: string;
		sessionCookieMaxAge: number;
	};
}
