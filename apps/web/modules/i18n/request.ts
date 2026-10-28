import { routing } from "@i18n/routing";
import { config } from "@repo/config";
import { getMessagesForLocale } from "@repo/i18n";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ requestLocale }) => {
	const requested = await requestLocale;
	const locale = hasLocale(routing.locales, requested)
		? requested
		: config.i18n.defaultLocale;

	return {
		locale,
		messages: await getMessagesForLocale(locale),
	};
});
