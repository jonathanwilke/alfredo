import { LocaleLink } from "@i18n/routing";
import { config } from "@repo/config";
import { cn } from "@ui/lib";
import { getLocale, getTranslations } from "next-intl/server";

export async function LocaleSwitch() {
	const locale = await getLocale();
	const t = await getTranslations("home");

	return (
		<nav
			aria-label={t("locale")}
			className="flex flex-wrap items-center gap-2 text-base"
		>
			{Object.entries(config.i18n.locales).map(([code, { label }]) => (
				<LocaleLink
					key={code}
					href="/"
					locale={code}
					hrefLang={code}
					aria-current={code === locale ? "page" : undefined}
					className={cn(
						"inline-flex min-h-12 items-center rounded-full px-4 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
						code === locale
							? "bg-accent text-accent-foreground"
							: "text-foreground hover:bg-muted",
					)}
				>
					{label}
				</LocaleLink>
			))}
		</nav>
	);
}
