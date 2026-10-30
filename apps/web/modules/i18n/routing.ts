import { config } from "@repo/config";
import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
	locales: Object.keys(config.i18n.locales),
	defaultLocale: config.i18n.defaultLocale,
	localeCookie: {
		name: config.i18n.localeCookieName,
	},
	localePrefix: "as-needed",
	localeDetection: true,
});

export const {
	Link: LocaleLink,
	redirect: localeRedirect,
	usePathname: useLocalePathname,
	useRouter: useNextIntlRouter,
} = createNavigation(routing);
